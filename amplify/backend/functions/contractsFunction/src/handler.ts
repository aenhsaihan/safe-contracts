import {
  randomBytes,
  randomUUID,
  createCipheriv,
  createDecipheriv,
  createHash,
} from 'crypto';
import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import {
  GenerateDataKeyCommand,
  KMSClient,
  GenerateDataKeyCommandInput,
  DecryptCommand,
} from '@aws-sdk/client-kms';
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  type GetObjectCommandOutput,
} from '@aws-sdk/client-s3';

const kmsClient = new KMSClient({});
const s3Client = new S3Client({});

const bucketName =
  process.env.SAFE_CONTRACTS_BUCKET ??
  process.env.SAFE_CONTRACTS_BUCKET_NAME ??
  process.env.CONTRACTS_BUCKET_NAME;

const kmsKeyId =
  process.env.SAFE_CONTRACTS_KMS_KEY_ID ??
  process.env.SAFE_CONTRACTS_MASTER_KEY_ID ??
  process.env.CONTRACTS_KMS_KEY_ID ??
  'alias/safe-contracts-master-key';

const dataApiUrl =
  process.env.SAFE_CONTRACTS_DATA_API_URL ??
  process.env.CONTRACTS_DATA_API_URL ??
  process.env.AMPLIFY_DATA_GRAPHQL_ENDPOINT ??
  process.env.DATA_API_URL;

const PACK_IV_LENGTH_BYTES = 12;
const PACK_AUTH_TAG_LENGTH_BYTES = 16;
const GET_CONTRACT_FILE_QUERY = /* GraphQL */ `
  query GetContractFile($id: ID!) {
    getContractFile(id: $id) {
      id
      exchangeId
      ownerId
      uploaderId
      s3Key
      fileName
      fileSize
      fileHash
      kmsKeyId
      kmsCiphertextKey
      encryptionContextOwnerId
      encryptionContextUploaderId
      encryptionContextExchangeId
      exchange {
        id
        partyAId
        partyBId
      }
    }
  }
`;

type EncryptAndUploadRequest = {
  operation: 'encryptAndUpload';
  payload: EncryptAndUploadPayload;
};

type DecryptAndDownloadRequest = {
  operation: 'decryptAndDownload';
  payload: DecryptAndDownloadPayload;
};

type ContractsFunctionOperationRequest =
  | EncryptAndUploadRequest
  | DecryptAndDownloadRequest;

type ContractsFunctionRequest =
  | ContractsFunctionOperationRequest
  | {
      operation: string;
      payload: unknown;
    };

type EncryptAndUploadPayload = {
  exchangeId: string;
  ownerId: string;
  uploaderId: string;
  fileName: string;
  fileSize: number;
  fileBase64: string;
};

type DecryptAndDownloadPayload = {
  fileId: string;
};

type ContractExchangeRecord = {
  id: string;
  partyAId?: string | null;
  partyBId?: string | null;
};

type ContractFileRecord = {
  id: string;
  exchangeId: string;
  ownerId: string;
  uploaderId: string;
  s3Key: string;
  fileName: string;
  fileSize: number;
  fileHash: string;
  kmsKeyId: string;
  kmsCiphertextKey: string;
  encryptionContextOwnerId: string;
  encryptionContextUploaderId: string;
  encryptionContextExchangeId: string;
  exchange?: ContractExchangeRecord | null;
};

type GraphQLContractFileRecord = Omit<ContractFileRecord, 'fileSize'> & {
  fileSize?: number | null;
};

type LambdaResponseBody = {
  result?: Record<string, unknown>;
  error?: string;
};

export const handler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => {
  try {
    const request = parseRequest(event);

    if (isEncryptAndUploadRequest(request)) {
      const result = await encryptAndUpload(request.payload);
      return jsonResponse({ result });
    }

    if (isDecryptAndDownloadRequest(request)) {
      const result = await decryptAndDownload(request.payload, event);
      return jsonResponse({ result });
    }

    return jsonResponse(
      { error: `Unsupported operation: ${request.operation}` },
      400,
    );
  } catch (error) {
    console.error('contractsFunction error', error);
    return jsonResponse(
      {
        error:
          error instanceof Error ? error.message : 'Unexpected server error',
      },
      500,
    );
  }
};

function parseRequest(event: APIGatewayProxyEventV2): ContractsFunctionRequest {
  if (!event.body) {
    throw new Error('Missing request body.');
  }

  const bodyString = event.isBase64Encoded
    ? Buffer.from(event.body, 'base64').toString('utf-8')
    : event.body;

  let parsed: ContractsFunctionRequest;
  try {
    parsed = JSON.parse(bodyString);
  } catch (error) {
    throw new Error(`Invalid JSON payload: ${(error as Error).message}`);
  }

  if (!parsed.operation) {
    throw new Error('Request missing operation.');
  }

  return parsed;
}

async function encryptAndUpload(payload: EncryptAndUploadPayload) {
  if (!bucketName) {
    throw new Error(
      'Missing SAFE_CONTRACTS_BUCKET/SAFE_CONTRACTS_BUCKET_NAME env variable.',
    );
  }

  if (!kmsKeyId) {
    throw new Error(
      'Missing SAFE_CONTRACTS_KMS_KEY_ID/SAFE_CONTRACTS_MASTER_KEY_ID env variable.',
    );
  }

  const {
    exchangeId,
    ownerId,
    uploaderId,
    fileName,
    fileSize,
    fileBase64,
  } = payload;

  const plaintextFile = Buffer.from(fileBase64, 'base64');
  if (!plaintextFile.length) {
    throw new Error('Decoded file payload is empty.');
  }

  if (fileSize > 0 && plaintextFile.length !== fileSize) {
    console.warn(
      `fileSize mismatch: declared ${fileSize}, decoded ${plaintextFile.length}`,
    );
  }

  const fileHash = sha256Hex(plaintextFile);
  const encryptionContext = {
    ownerId,
    uploaderId,
    exchangeId,
  };

  const dataKey = await generateDataKey({
    KeyId: kmsKeyId,
    KeySpec: 'AES_256',
    EncryptionContext: encryptionContext,
  });

  const { packedPayload, ciphertextKey } = encryptPayload(
    plaintextFile,
    dataKey,
  );

  const fileId = randomUUID();
  const s3Key = `contract-files/${exchangeId}/${fileId}`;

  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: s3Key,
      Body: packedPayload,
      Metadata: {
        'file-name': fileName,
        'file-size': String(fileSize),
        'file-hash': fileHash,
        'kms-key-id': kmsKeyId,
        'kms-ciphertext-key': ciphertextKey,
        'encryption-context-owner-id': ownerId,
        'encryption-context-uploader-id': uploaderId,
        'encryption-context-exchange-id': exchangeId,
      },
    }),
  );

  return {
    fileId,
    s3Key,
    fileHash,
  };
}

async function decryptAndDownload(
  payload: DecryptAndDownloadPayload,
  event: APIGatewayProxyEventV2,
) {
  if (!bucketName) {
    throw new Error(
      'Missing SAFE_CONTRACTS_BUCKET/SAFE_CONTRACTS_BUCKET_NAME env variable.',
    );
  }

  const { fileId } = payload;
  const normalizedFileId = typeof fileId === 'string' ? fileId.trim() : '';
  if (!normalizedFileId) {
    throw new Error('Provide the fileId to download.');
  }

  const authorizationHeader = extractAuthorizationHeader(event);
  if (!authorizationHeader) {
    throw new Error(
      'Missing Authorization header. Sign in again and retry the download.',
    );
  }

  const userId = getAuthenticatedUserId(event);
  if (!userId) {
    throw new Error('Unable to resolve authenticated user from the request.');
  }

  const contractFile = await lookupContractFile(
    normalizedFileId,
    authorizationHeader,
  );

  assertUserAuthorized(contractFile, userId);

  const s3Object = await s3Client.send(
    new GetObjectCommand({
      Bucket: bucketName,
      Key: contractFile.s3Key,
    }),
  );

  const encryptedPayload = await readS3Body(s3Object);
  const { iv, ciphertext, authTag } = unpackEncryptedPayload(encryptedPayload);

  const encryptionContext = {
    ownerId: contractFile.encryptionContextOwnerId,
    uploaderId: contractFile.encryptionContextUploaderId,
    exchangeId: contractFile.encryptionContextExchangeId,
  };

  const decryptResponse = await kmsClient.send(
    new DecryptCommand({
      CiphertextBlob: Buffer.from(contractFile.kmsCiphertextKey, 'base64'),
      EncryptionContext: encryptionContext,
      KeyId: contractFile.kmsKeyId ?? kmsKeyId,
    }),
  );

  if (!decryptResponse.Plaintext) {
    throw new Error('KMS did not return plaintext data key for file decrypt.');
  }

  const plaintextKey = Buffer.from(decryptResponse.Plaintext);
  const decipher = createDecipheriv('aes-256-gcm', plaintextKey, iv);
  decipher.setAuthTag(authTag);

  const plaintextFile = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  plaintextKey.fill(0);

  const computedHash = sha256Hex(plaintextFile);
  if (computedHash !== contractFile.fileHash) {
    throw new Error(
      'Integrity verification failed. The decrypted file hash does not match the stored hash.',
    );
  }

  return {
    fileName: contractFile.fileName,
    fileHash: contractFile.fileHash,
    fileBase64: plaintextFile.toString('base64'),
  };
}

async function generateDataKey(input: GenerateDataKeyCommandInput) {
  const response = await kmsClient.send(new GenerateDataKeyCommand(input));

  if (!response.Plaintext || !response.CiphertextBlob) {
    throw new Error('KMS GenerateDataKey did not return both key materials.');
  }

  return {
    plaintextKey: Buffer.from(response.Plaintext),
    ciphertextKey: Buffer.from(response.CiphertextBlob),
  };
}

function encryptPayload(
  plaintext: Buffer,
  dataKey: { plaintextKey: Buffer; ciphertextKey: Buffer },
) {
  const iv = randomBytes(PACK_IV_LENGTH_BYTES);
  const cipher = createCipheriv('aes-256-gcm', dataKey.plaintextKey, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  dataKey.plaintextKey.fill(0); // Clear plaintext key material

  const packedPayload = packEncryptedPayload({ iv, ciphertext, authTag });
  const ciphertextKey = dataKey.ciphertextKey.toString('base64');

  return {
    packedPayload,
    ciphertextKey,
  };
}

function packEncryptedPayload({
  iv,
  ciphertext,
  authTag,
}: {
  iv: Buffer;
  ciphertext: Buffer;
  authTag: Buffer;
}) {
  if (iv.length !== PACK_IV_LENGTH_BYTES) {
    throw new Error(
      `IV must be ${PACK_IV_LENGTH_BYTES} bytes, received ${iv.length}`,
    );
  }

  if (authTag.length !== PACK_AUTH_TAG_LENGTH_BYTES) {
    throw new Error(
      `Auth tag must be ${PACK_AUTH_TAG_LENGTH_BYTES} bytes, received ${authTag.length}`,
    );
  }

  const buffer = Buffer.allocUnsafe(
    PACK_IV_LENGTH_BYTES + ciphertext.length + PACK_AUTH_TAG_LENGTH_BYTES,
  );
  iv.copy(buffer, 0);
  ciphertext.copy(buffer, PACK_IV_LENGTH_BYTES);
  authTag.copy(buffer, PACK_IV_LENGTH_BYTES + ciphertext.length);

  return buffer;
}

function unpackEncryptedPayload(buffer: Buffer) {
  if (
    buffer.length <
    PACK_IV_LENGTH_BYTES + PACK_AUTH_TAG_LENGTH_BYTES
  ) {
    throw new Error('Encrypted payload buffer is too small.');
  }

  const ciphertextLength =
    buffer.length - PACK_IV_LENGTH_BYTES - PACK_AUTH_TAG_LENGTH_BYTES;

  const iv = Buffer.from(buffer.subarray(0, PACK_IV_LENGTH_BYTES));
  const ciphertext = Buffer.from(
    buffer.subarray(
      PACK_IV_LENGTH_BYTES,
      PACK_IV_LENGTH_BYTES + ciphertextLength,
    ),
  );
  const authTag = Buffer.from(
    buffer.subarray(buffer.length - PACK_AUTH_TAG_LENGTH_BYTES),
  );

  return { iv, ciphertext, authTag };
}

async function lookupContractFile(
  fileId: string,
  authorizationHeader: string,
): Promise<ContractFileRecord> {
  if (!dataApiUrl) {
    throw new Error(
      'Missing SAFE_CONTRACTS_DATA_API_URL/CONTRACTS_DATA_API_URL env variable for metadata lookups.',
    );
  }

  const response = await fetch(dataApiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: authorizationHeader,
    },
    body: JSON.stringify({
      query: GET_CONTRACT_FILE_QUERY,
      variables: { id: fileId },
    }),
  });

  if (!response.ok) {
    throw new Error(
      `ContractFile lookup failed with ${response.status} ${response.statusText}.`,
    );
  }

  const json = (await response.json()) as {
    data?: { getContractFile?: GraphQLContractFileRecord };
    errors?: { message?: string }[];
  };

  if (json.errors?.length) {
    const message = json.errors.map((error) => error.message).join('; ');
    throw new Error(`ContractFile lookup returned errors: ${message}`);
  }

  const record = json.data?.getContractFile;
  if (!record) {
    throw new Error(`ContractFile ${fileId} not found.`);
  }

  if (!record.kmsCiphertextKey || !record.kmsKeyId || !record.s3Key) {
    throw new Error(
      `ContractFile ${fileId} metadata is incomplete (missing S3 key or KMS key reference).`,
    );
  }

  const normalizedFileSize =
    typeof record.fileSize === 'number'
      ? record.fileSize
      : Number(record.fileSize ?? NaN);

  if (!Number.isFinite(normalizedFileSize)) {
    throw new Error(
      `ContractFile ${fileId} is missing a valid fileSize attribute.`,
    );
  }

  return {
    ...record,
    fileSize: normalizedFileSize,
  };
}

function assertUserAuthorized(record: ContractFileRecord, userId: string) {
  const allowedIds = [
    record.ownerId,
    record.uploaderId,
    record.exchange?.partyAId ?? undefined,
    record.exchange?.partyBId ?? undefined,
  ].filter(
    (value): value is string => typeof value === 'string' && value.length > 0,
  );

  if (!allowedIds.includes(userId)) {
    throw new Error('You are not authorized to download this file.');
  }
}

async function readS3Body(
  response: GetObjectCommandOutput,
): Promise<Buffer> {
  const { Body } = response;
  if (!Body) {
    throw new Error('S3 object download did not include a payload body.');
  }

  if (Body instanceof Uint8Array) {
    return Buffer.from(Body);
  }

  if (Buffer.isBuffer(Body)) {
    return Body;
  }

  if (typeof Body === 'string') {
    return Buffer.from(Body);
  }

  const bodyAny = Body as {
    transformToByteArray?: () => Promise<Uint8Array>;
  };
  if (typeof bodyAny.transformToByteArray === 'function') {
    const arr = await bodyAny.transformToByteArray();
    return Buffer.from(arr);
  }

  if (Symbol.asyncIterator in (Body as unknown as Record<string, unknown>)) {
    const chunks: Buffer[] = [];
    for await (const chunk of Body as AsyncIterable<Buffer | Uint8Array>) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  throw new Error('Unsupported S3 body payload type encountered.');
}

function extractAuthorizationHeader(event: APIGatewayProxyEventV2) {
  const headers = event.headers ?? {};

  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === 'authorization' && value) {
      return value;
    }
  }

  return undefined;
}

function getAuthenticatedUserId(event: APIGatewayProxyEventV2) {
  const requestContext = (event.requestContext ?? {}) as unknown as {
    authorizer?: {
      jwt?: { claims?: Record<string, unknown> };
      lambda?: Record<string, unknown>;
    };
  };

  const authorizer = requestContext.authorizer;
  const claims = (authorizer?.jwt?.claims ?? {}) as Record<string, unknown>;
  const claimKeys = ['sub', 'username', 'cognito:username'];

  for (const key of claimKeys) {
    const value = claims[key];
    if (typeof value === 'string' && value.trim()) {
      return value;
    }
  }

  const lambdaContext = (authorizer?.lambda ?? {}) as Record<string, unknown>;
  const lambdaSub = lambdaContext.sub;
  if (typeof lambdaSub === 'string' && lambdaSub.trim()) {
    return lambdaSub;
  }

  return undefined;
}

function isEncryptAndUploadRequest(
  request: ContractsFunctionRequest,
): request is EncryptAndUploadRequest {
  return request.operation === 'encryptAndUpload';
}

function isDecryptAndDownloadRequest(
  request: ContractsFunctionRequest,
): request is DecryptAndDownloadRequest {
  return request.operation === 'decryptAndDownload';
}

function sha256Hex(data: Buffer) {
  return createHash('sha256').update(data).digest('hex');
}

function jsonResponse(body: LambdaResponseBody, statusCode = 200) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}
