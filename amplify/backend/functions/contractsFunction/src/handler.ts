import { randomBytes, randomUUID, createCipheriv, createHash } from 'crypto';
import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import {
  GenerateDataKeyCommand,
  KMSClient,
  GenerateDataKeyCommandInput,
} from '@aws-sdk/client-kms';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

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

const PACK_IV_LENGTH_BYTES = 12;
const PACK_AUTH_TAG_LENGTH_BYTES = 16;

type ContractsFunctionRequest =
  | {
      operation: 'encryptAndUpload';
      payload: EncryptAndUploadPayload;
    }
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

type LambdaResponseBody = {
  result?: Record<string, unknown>;
  error?: string;
};

export const handler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => {
  try {
    const request = parseRequest(event);

    switch (request.operation) {
      case 'encryptAndUpload': {
        const result = await encryptAndUpload(request.payload);
        return jsonResponse({ result });
      }
      default:
        return jsonResponse(
          { error: `Unsupported operation: ${request.operation}` },
          400,
        );
    }
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
