const IV_LENGTH_BYTES = 12;
const AUTH_TAG_LENGTH_BYTES = 16;

export interface EncryptionComponents {
  iv: Buffer;
  ciphertext: Buffer;
  authTag: Buffer;
}

/**
 * Packs IV, ciphertext, and auth tag into a single buffer for storage.
 */
export function packEncryptedPayload({
  iv,
  ciphertext,
  authTag,
}: EncryptionComponents): Buffer {
  if (iv.length !== IV_LENGTH_BYTES) {
    throw new Error(`IV must be ${IV_LENGTH_BYTES} bytes, got ${iv.length}`);
  }

  if (authTag.length !== AUTH_TAG_LENGTH_BYTES) {
    throw new Error(
      `authTag must be ${AUTH_TAG_LENGTH_BYTES} bytes, got ${authTag.length}`,
    );
  }

  const totalLength = IV_LENGTH_BYTES + ciphertext.length + AUTH_TAG_LENGTH_BYTES;
  const packed = Buffer.allocUnsafe(totalLength);

  iv.copy(packed, 0);
  ciphertext.copy(packed, IV_LENGTH_BYTES);
  authTag.copy(packed, IV_LENGTH_BYTES + ciphertext.length);

  return packed;
}

/**
 * Unpacks a buffer produced by packEncryptedPayload into its components.
 */
export function unpackEncryptedPayload(buffer: Buffer): EncryptionComponents {
  if (buffer.length < IV_LENGTH_BYTES + AUTH_TAG_LENGTH_BYTES) {
    throw new Error('Buffer too small to contain encrypted payload.');
  }

  const ciphertextLength = buffer.length - IV_LENGTH_BYTES - AUTH_TAG_LENGTH_BYTES;
  const iv = buffer.subarray(0, IV_LENGTH_BYTES);
  const ciphertext = buffer.subarray(IV_LENGTH_BYTES, IV_LENGTH_BYTES + ciphertextLength);
  const authTag = buffer.subarray(buffer.length - AUTH_TAG_LENGTH_BYTES);

  return {
    iv: Buffer.from(iv),
    ciphertext: Buffer.from(ciphertext),
    authTag: Buffer.from(authTag),
  };
}

export const CRYPTO_CONSTANTS = {
  IV_LENGTH_BYTES,
  AUTH_TAG_LENGTH_BYTES,
};
