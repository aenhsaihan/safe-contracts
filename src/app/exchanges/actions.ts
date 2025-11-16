"use server";

import { revalidatePath } from "next/cache";

import { updateContractExchangeStatus } from "@/lib/contracts-data";

/**
 * Marks an exchange as completed once the file upload cycle finishes.
 * Revalidation ensures dashboard and detail views immediately reflect the new status.
 */
export async function markExchangeCompletedAction(exchangeId: string) {
  const normalizedExchangeId = exchangeId?.trim();

  if (!normalizedExchangeId) {
    throw new Error("Exchange ID is required to update status.");
  }

  await updateContractExchangeStatus({
    id: normalizedExchangeId,
    status: "COMPLETED",
  });

  revalidatePath("/");
  revalidatePath(`/exchanges/${encodeURIComponent(normalizedExchangeId)}`);
}

