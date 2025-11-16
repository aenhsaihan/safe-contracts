"use server";

import { revalidatePath } from "next/cache";

import {
  getCurrentUserServerSide,
  invokeContractsFunction,
  type ContractsFunctionOperationMap,
} from "@/lib/amplify-server";
import {
  getContractExchangeById,
  getContractFileById,
  createContractFileRecord,
} from "@/lib/contracts-data";

type UploadInput = ContractsFunctionOperationMap["encryptAndUpload"]["input"];
type UploadResult = ContractsFunctionOperationMap["encryptAndUpload"]["output"];
type DownloadResult = ContractsFunctionOperationMap["decryptAndDownload"]["output"];

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB
const MAX_FILE_NAME_LENGTH = 255;
const MAX_DESCRIPTION_LENGTH = 500;
const MIME_TYPE_ERROR_MESSAGE =
  "That file type is not allowed. Upload a PDF, DOC/DOCX, TXT, PNG, or JPEG file.";
const GENERIC_MIME_TYPE = "application/octet-stream";

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv",
  "image/png",
  "image/jpeg",
]);

const EXTENSION_TO_MIME: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
  txt: "text/plain",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
};

const BASE64_REGEX =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

type UploadActionInput = UploadInput & {
  fileType?: string | null;
  description?: string | null;
};

export async function uploadExchangeFileAction(input: UploadActionInput): Promise<UploadResult> {
  const { payload, description } = validateAndNormalizeUploadInput(input);

  const currentUser = await getCurrentUserServerSide();
  const currentUserId = currentUser?.userId;

  if (!currentUserId) {
    throw new Error("You must be signed in to upload files.");
  }

  const exchange = await getContractExchangeById(payload.exchangeId);

  if (!exchange) {
    throw new Error("Exchange not found.");
  }

  assertUserIsParticipant(exchange, currentUserId);

  if (payload.uploaderId !== currentUserId) {
    throw new Error("Upload attempt rejected: uploader mismatch.");
  }

  if (
    payload.ownerId !== exchange.partyAId &&
    payload.ownerId !== exchange.partyBId
  ) {
    throw new Error("Owner must match one of the exchange parties.");
  }

  if (description) {
    // TODO: Persist descriptions in ContractFile records once supported by the backend schema.
  }

  const result = await invokeContractsFunction({
    operation: "encryptAndUpload",
    payload,
  });

  // Create ContractFile record in DynamoDB after successful upload
  await createContractFileRecord({
    id: result.fileId,
    exchangeId: payload.exchangeId,
    ownerId: payload.ownerId,
    uploaderId: payload.uploaderId,
    fileName: payload.fileName,
    fileSize: payload.fileSize,
    fileHash: result.fileHash,
    s3Key: result.s3Key,
    kmsKeyId: result.kmsKeyId,
    kmsCiphertextKey: result.kmsCiphertextKey,
    encryptionContextOwnerId: result.encryptionContextOwnerId,
    encryptionContextUploaderId: result.encryptionContextUploaderId,
    encryptionContextExchangeId: result.encryptionContextExchangeId,
  });

  revalidatePath("/");
  revalidatePath(`/exchanges/${exchange.id}`);

  return result;
}

export async function downloadExchangeFileAction(input: {
  exchangeId: string;
  fileId: string;
}): Promise<DownloadResult> {
  const currentUser = await getCurrentUserServerSide();
  const currentUserId = currentUser?.userId;

  if (!currentUserId) {
    throw new Error("You must be signed in to download files.");
  }

  const [exchange, fileRecord] = await Promise.all([
    getContractExchangeById(input.exchangeId),
    getContractFileById(input.fileId),
  ]);

  if (!exchange) {
    throw new Error("Exchange not found.");
  }

  assertUserIsParticipant(exchange, currentUserId);

  if (!fileRecord || fileRecord.exchangeId !== exchange.id) {
    throw new Error("File not found in this exchange.");
  }

  return invokeContractsFunction({
    operation: "decryptAndDownload",
    payload: { fileId: input.fileId },
  });
}

function assertUserIsParticipant(
  exchange: { partyAId: string; partyBId: string },
  userId: string
) {
  if (userId === exchange.partyAId || userId === exchange.partyBId) {
    return;
  }

  throw new Error("You are not authorized to act on this exchange.");
}

function validateAndNormalizeUploadInput(input: UploadActionInput): {
  payload: UploadInput;
  description?: string | null;
} {
  const exchangeId = normalizeIdentifier(input.exchangeId, "exchange");
  const ownerId = normalizeIdentifier(input.ownerId, "owner");
  const uploaderId = normalizeIdentifier(input.uploaderId, "uploader");
  const fileName = normalizeFileName(input.fileName);
  const fileSize = normalizeFileSize(input.fileSize);
  ensureMimeTypeAllowed(input.fileType, fileName);
  const fileBase64 = normalizeBase64Payload(input.fileBase64, fileSize);
  const description = normalizeDescription(input.description);

  return {
    payload: {
      exchangeId,
      ownerId,
      uploaderId,
      fileName,
      fileSize,
      fileBase64,
    },
    description,
  };
}

function normalizeIdentifier(value: string, label: string) {
  const trimmed = (value ?? "").trim();
  if (!trimmed) {
    throw new Error(`Missing ${label} identifier for this upload.`);
  }
  return trimmed;
}

function normalizeFileName(name: string) {
  const trimmed = (name ?? "").trim();
  if (!trimmed) {
    throw new Error("The uploaded file is missing a name.");
  }
  if (trimmed.length > MAX_FILE_NAME_LENGTH) {
    throw new Error("File name exceeds the 255 character limit.");
  }

  return trimmed;
}

function normalizeFileSize(size: number) {
  const numericSize = Number(size);
  if (!Number.isFinite(numericSize) || numericSize <= 0) {
    throw new Error("The uploaded file is empty.");
  }

  if (numericSize > MAX_FILE_SIZE_BYTES) {
    throw new Error(`Files are limited to ${formatFileSize(MAX_FILE_SIZE_BYTES)}.`);
  }

  return Math.trunc(numericSize);
}

function ensureMimeTypeAllowed(fileType: string | null | undefined, fileName: string) {
  const normalizedType = (fileType ?? "").trim().toLowerCase();
  if (normalizedType && ALLOWED_MIME_TYPES.has(normalizedType)) {
    return;
  }

  if (normalizedType && normalizedType !== GENERIC_MIME_TYPE) {
    throw new Error(MIME_TYPE_ERROR_MESSAGE);
  }

  const fallbackType = inferMimeFromExtension(fileName);
  if (fallbackType && ALLOWED_MIME_TYPES.has(fallbackType)) {
    return;
  }

  throw new Error(MIME_TYPE_ERROR_MESSAGE);
}

function inferMimeFromExtension(fileName: string) {
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
  return EXTENSION_TO_MIME[extension];
}

function normalizeBase64Payload(payload: string, expectedSize: number) {
  if (typeof payload !== "string") {
    throw new Error("Upload payload missing file contents.");
  }

  const trimmed = payload.trim();
  if (!trimmed) {
    throw new Error("Upload payload missing file contents.");
  }

  if (!BASE64_REGEX.test(trimmed)) {
    throw new Error("File payload includes invalid Base64 characters.");
  }

  let decoded: Buffer;
  try {
    decoded = Buffer.from(trimmed, "base64");
  } catch {
    throw new Error("File payload is not valid Base64 data.");
  }

  if (!decoded.length) {
    throw new Error("Decoded file payload is empty.");
  }

  if (decoded.length > MAX_FILE_SIZE_BYTES) {
    decoded.fill(0);
    throw new Error(`Files are limited to ${formatFileSize(MAX_FILE_SIZE_BYTES)}.`);
  }

  if (decoded.length !== expectedSize) {
    decoded.fill(0);
    throw new Error("Decoded file size does not match the reported file size.");
  }

  decoded.fill(0);
  return trimmed;
}

function normalizeDescription(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.length > MAX_DESCRIPTION_LENGTH) {
    return trimmed.slice(0, MAX_DESCRIPTION_LENGTH);
  }

  return trimmed;
}

function formatFileSize(bytes: number) {
  if (bytes >= 1024 * 1024) {
    const mbValue = bytes / (1024 * 1024);
    return `${mbValue.toFixed(mbValue % 1 === 0 ? 0 : 1)} MB`;
  }

  if (bytes >= 1024) {
    const kbValue = bytes / 1024;
    return `${kbValue.toFixed(kbValue % 1 === 0 ? 0 : 1)} KB`;
  }

  return `${bytes} B`;
}
