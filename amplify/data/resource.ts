import { type ClientSchema, a, defineData } from "@aws-amplify/backend";

/**
 * SafeContracts Data Schema
 *
 * Defines ContractExchange and ContractFile models for storing
 * encrypted contract metadata and relationships.
 */

const schema = a.schema({
  // Enum for contract exchange status
  ExchangeStatus: a.enum(["PENDING", "COMPLETED"]),

  // ContractExchange: Represents a contract relationship between two parties
  ContractExchange: a
    .model({
      title: a.string().required(),
      partyAId: a.string().required(), // Cognito sub of party A
      partyBId: a.string().required(), // Cognito sub of party B
      createdById: a.string().required(), // Cognito sub of creator
      status: a.ref("ExchangeStatus"),
      // Relationship: hasMany ContractFile
      files: a.hasMany("ContractFile", "exchangeId"),
    })
    .authorization((allow) => [
      // Allow authenticated users to perform all operations
      // Fine-grained authorization (partyA/partyB/creator checks) will be handled
      // in Lambda functions and AppSync resolvers for security
      allow.authenticated(),
    ]),

  // ContractFile: Represents an encrypted contract file stored in S3
  ContractFile: a
    .model({
      exchangeId: a.id().required(), // Foreign key to ContractExchange
      ownerId: a.string().required(), // Cognito sub of file owner (party A or B)
      uploaderId: a.string().required(), // Cognito sub of who uploaded
      s3Key: a.string().required(), // S3 object key where ciphertext is stored
      fileName: a.string().required(), // Original filename
      fileSize: a.integer().required(), // File size in bytes
      fileHash: a.string().required(), // SHA-256 hash of plaintext before encryption
      kmsKeyId: a.string().required(), // KMS CMK key ID used for data key
      kmsCiphertextKey: a.string().required(), // Base64 encoded encrypted data key
      encryptionContextOwnerId: a.string().required(), // Encryption context field
      encryptionContextUploaderId: a.string().required(), // Encryption context field
      encryptionContextExchangeId: a.string().required(), // Encryption context field
      // Relationship: belongsTo ContractExchange
      exchange: a.belongsTo("ContractExchange", "exchangeId"),
    })
    .authorization((allow) => [
      // Allow authenticated users to perform all operations
      // Fine-grained authorization checks (partyA/partyB of parent exchange,
      // uploader/owner) will be enforced in Lambda functions and AppSync resolvers
      allow.authenticated(),
    ]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: "userPool",
  },
});
