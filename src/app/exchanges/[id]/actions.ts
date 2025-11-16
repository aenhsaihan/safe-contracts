import { revalidatePath } from "next/cache";

import {
  getCurrentUserServerSide,
  invokeContractsFunction,
  type ContractsFunctionOperationMap,
} from "@/lib/amplify-server";
import {
  getContractExchangeById,
  getContractFileById,
} from "@/lib/contracts-data";

type UploadInput = ContractsFunctionOperationMap["encryptAndUpload"]["input"];
type UploadResult = ContractsFunctionOperationMap["encryptAndUpload"]["output"];
type DownloadResult = ContractsFunctionOperationMap["decryptAndDownload"]["output"];

export async function uploadExchangeFileAction(input: UploadInput): Promise<UploadResult> {
  "use server";

  const currentUser = await getCurrentUserServerSide();
  const currentUserId = currentUser?.userId;

  if (!currentUserId) {
    throw new Error("You must be signed in to upload files.");
  }

  const exchange = await getContractExchangeById(input.exchangeId);

  if (!exchange) {
    throw new Error("Exchange not found.");
  }

  assertUserIsParticipant(exchange, currentUserId);

  if (input.uploaderId !== currentUserId) {
    throw new Error("Upload attempt rejected: uploader mismatch.");
  }

  if (input.ownerId !== exchange.partyAId && input.ownerId !== exchange.partyBId) {
    throw new Error("Owner must match one of the exchange parties.");
  }

  const result = await invokeContractsFunction({
    operation: "encryptAndUpload",
    payload: input,
  });

  revalidatePath("/");
  revalidatePath(`/exchanges/${encodeURIComponent(exchange.id)}`);

  return result;
}

export async function downloadExchangeFileAction(input: {
  exchangeId: string;
  fileId: string;
}): Promise<DownloadResult> {
  "use server";

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
