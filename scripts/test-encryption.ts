import 'dotenv/config';

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
} from 'crypto';
import {
  KMSClient,
  GenerateDataKeyCommand,
  DecryptCommand,
} from '@aws-sdk/client-kms';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import {
  packEncryptedPayload,
  unpackEncryptedPayload,
} from '../src/lib/crypto-utils';

const SAMPLE_BASE64_PAYLOAD =
  'U2FmZUNvbnRyYWN0c0VuY3J5cHRpb25Sb3VuZFRyaXBQYXlsb2FkIQ==';
const SAMPLE_PAYLOAD = Buffer.from(SAMPLE_BASE64_PAYLOAD, 'base64');
const SAMPLE_PAYLOAD_HASH = sha256Hex(SAMPLE_PAYLOAD);

const region = process.env.AWS_REGION ?? 'ap-southeast-2';
const bucketName =
  process.env.SAFE_CONTRACTS_BUCKET ?? process.env.SAFE_CONTRACTS_BUCKET_NAME;
const kmsKeyId =
  process.env.SAFE_CONTRACTS_KMS_KEY_ID ?? 'alias/safe-contracts-master-key';

const encryptionContext = {
  ownerId: process.env.SAFE_CONTRACTS_OWNER_ID ?? 'owner-demo',
  uploaderId: process.env.SAFE_CONTRACTS_UPLOADER_ID ?? 'uploader-demo',
  exchangeId: process.env.SAFE_CONTRACTS_EXCHANGE_ID ?? 'exchange-demo',
};

if (!bucketName) {
  throw new Error(
    'Missing bucket name. Set SAFE_CONTRACTS_BUCKET or SAFE_CONTRACTS_BUCKET_NAME.',
  );
}

const kmsClient = new KMSClient({ region });
const s3Client = new S3Client({ region });

function sha256Hex(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

async function bodyToBuffer(body: unknown): Promise<Buffer> {
  if (!body) {
    throw new Error('S3 response missing Body payload.');
  }

  if (body instanceof Uint8Array) {
    return Buffer.from(body);
  }

  if (Buffer.isBuffer(body)) {
    return body;
  }

  if (typeof body === 'string') {
    return Buffer.from(body);
  }

  if (typeof (body as any).transformToByteArray === 'function') {
    const arr = await (body as any).transformToByteArray();
    return Buffer.from(arr);
  }

  if (Symbol.asyncIterator in (body as any)) {
    const chunks: Buffer[] = [];
    for await (const chunk of body as AsyncIterable<Buffer>) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  throw new Error('Unsupported S3 Body payload type.');
}

async function runRoundTrip(): Promise<void> {
  const objectKey = `test-encryption/${new Date()
    .toISOString()
    .replace(/[:.]/g, '-')}-${randomUUID()}.bin`;
  let uploaded = false;

  try {
    console.log('--- SafeContracts encryption round-trip ---');
    console.log(`Region: ${region}`);
    console.log(`Bucket: ${bucketName}`);
    console.log(`KMS Key: ${kmsKeyId}`);
    console.log('Encryption context:', encryptionContext);
    console.log('Sample payload hash:', SAMPLE_PAYLOAD_HASH);

    console.log('\n1) Generating data key from KMS...');
    const generateResp = await kmsClient.send(
      new GenerateDataKeyCommand({
        KeyId: kmsKeyId,
        KeySpec: 'AES_256',
        EncryptionContext: encryptionContext,
      }),
    );

    if (!generateResp.Plaintext || !generateResp.CiphertextBlob) {
      throw new Error('KMS did not return plaintext and ciphertext data keys.');
    }

    const plaintextKey = Buffer.from(generateResp.Plaintext);
    const ciphertextKey = Buffer.from(generateResp.CiphertextBlob);

    console.log('2) Encrypting payload with AES-256-GCM...');
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', plaintextKey, iv);
    const ciphertext = Buffer.concat([
      cipher.update(SAMPLE_PAYLOAD),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    const packedPayload = packEncryptedPayload({ iv, ciphertext, authTag });
    plaintextKey.fill(0); // Clear plaintext key material from memory

    console.log(`3) Uploading encrypted payload to s3://${bucketName}/${objectKey}`);
    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: objectKey,
        Body: packedPayload,
        Metadata: {
          'file-hash': SAMPLE_PAYLOAD_HASH,
          'kms-key-id': kmsKeyId,
          'kms-ciphertext-key': ciphertextKey.toString('base64'),
          'encryption-context-owner-id': encryptionContext.ownerId,
          'encryption-context-uploader-id': encryptionContext.uploaderId,
          'encryption-context-exchange-id': encryptionContext.exchangeId,
        },
      }),
    );
    uploaded = true;

    console.log('4) Downloading object and decrypting data key via KMS...');
    const download = await s3Client.send(
      new GetObjectCommand({ Bucket: bucketName, Key: objectKey }),
    );
    const downloadedPayload = await bodyToBuffer(download.Body);
    const { iv: storedIv, ciphertext: storedCiphertext, authTag: storedAuthTag } =
      unpackEncryptedPayload(downloadedPayload);

    const decryptResp = await kmsClient.send(
      new DecryptCommand({
        CiphertextBlob: ciphertextKey,
        EncryptionContext: encryptionContext,
        KeyId: kmsKeyId,
      }),
    );

    if (!decryptResp.Plaintext) {
      throw new Error('KMS Decrypt did not return plaintext key material.');
    }

    const decryptedKey = Buffer.from(decryptResp.Plaintext);
    const decipher = createDecipheriv('aes-256-gcm', decryptedKey, storedIv);
    decipher.setAuthTag(storedAuthTag);

    const decryptedPlaintext = Buffer.concat([
      decipher.update(storedCiphertext),
      decipher.final(),
    ]);
    decryptedKey.fill(0);

    console.log('5) Verifying SHA-256 hash of decrypted payload...');
    const decryptedHash = sha256Hex(decryptedPlaintext);
    if (decryptedHash !== SAMPLE_PAYLOAD_HASH) {
      throw new Error(
        `Hash mismatch! expected ${SAMPLE_PAYLOAD_HASH} but got ${decryptedHash}`,
      );
    }

    console.log('✓ Round-trip succeeded. Hash match confirmed.');
  } finally {
    if (uploaded) {
      console.log('Cleaning up uploaded test object...');
      await s3Client
        .send(
          new DeleteObjectCommand({
            Bucket: bucketName,
            Key: objectKey,
          }),
        )
        .catch((error) => {
          console.warn('Warning: failed to delete test object:', error);
        });
    }
  }
}

runRoundTrip().catch((error) => {
  console.error('Encryption round-trip failed:', error);
  process.exitCode = 1;
});
