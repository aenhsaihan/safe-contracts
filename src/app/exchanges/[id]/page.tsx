import Link from "next/link";
import { notFound } from "next/navigation";

import ExchangeDetail from "@/components/exchanges/ExchangeDetail";
import { getCurrentUserServerSide } from "@/lib/amplify-server";
import {
  type ContractExchangeRecord,
  getContractExchangeById,
  listContractFilesForExchange,
} from "@/lib/contracts-data";

type PageParams = { id: string };

export default async function ExchangeDetailPage({
  params,
}: {
  params: PageParams | Promise<PageParams>;
}) {
  const resolvedParams = await params;
  const exchangeId = decodeURIComponent(resolvedParams.id);

  const [currentUser, exchange] = await Promise.all([
    getCurrentUserServerSide(),
    getContractExchangeById(exchangeId),
  ]);

  if (!exchange) {
    notFound();
  }

  const files = (await listContractFilesForExchange(exchangeId)).sort((left, right) => {
    const leftDate = new Date(left.createdAt ?? left.updatedAt ?? 0).getTime();
    const rightDate = new Date(right.createdAt ?? right.updatedAt ?? 0).getTime();
    return rightDate - leftDate;
  });

  const mappedFiles = files.map((file) => ({
    id: file.id,
    fileName: file.fileName,
    fileSize: file.fileSize ?? 0,
    owner: describeParticipant(file.ownerId, exchange),
    uploader: describeParticipant(file.uploaderId, exchange),
    uploadedAt: file.createdAt ?? file.updatedAt ?? new Date().toISOString(),
    sha256: file.fileHash ?? undefined,
    fileHash: file.fileHash ?? undefined,
    ownerId: file.ownerId, // Keep ownerId for status resolution
  }));

  const exchangeDetailProps = {
    exchange: {
      id: exchange.id,
      title: exchange.title,
      partyA: `Party A (${exchange.partyAId})`,
      partyAId: exchange.partyAId,
      partyB: `Party B (${exchange.partyBId})`,
      partyBId: exchange.partyBId,
      status: resolveExchangeStatus(
        exchange.status,
        mappedFiles,
        exchange.partyAId,
        exchange.partyBId
      ),
      createdAt: exchange.createdAt ?? new Date().toISOString(),
    },
    files: mappedFiles,
    currentUserId: currentUser?.userId ?? "",
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-10">
        <div className="text-sm text-zinc-500">
          <Link href="/" className="font-medium text-sky-600 hover:underline">
            ← Back to dashboard
          </Link>
        </div>

        <ExchangeDetail {...exchangeDetailProps} />
      </main>
    </div>
  );
}

function resolveExchangeStatus(
  status: string | null | undefined,
  files: Array<{ ownerId: string }>,
  partyAId: string,
  partyBId: string
): "PENDING" | "COMPLETED" | "ACTION_REQUIRED" {
  if (status === "ACTION_REQUIRED") {
    return status;
  }
  
  // Check if both parties have uploaded at least one file
  const partyAHasFiles = files.some((file) => file.ownerId === partyAId);
  const partyBHasFiles = files.some((file) => file.ownerId === partyBId);
  const bothPartiesHaveUploaded = partyAHasFiles && partyBHasFiles;
  
  if (bothPartiesHaveUploaded) {
    return "COMPLETED";
  }
  
  // If only one party has uploaded, show ACTION_REQUIRED
  if (partyAHasFiles || partyBHasFiles) {
    return "ACTION_REQUIRED";
  }
  
  return "PENDING";
}

function describeParticipant(userId: string | null | undefined, exchange: ContractExchangeRecord) {
  if (!userId) {
    return "Unknown participant";
  }
  if (userId === exchange.partyAId) {
    return `Party A (${userId})`;
  }
  if (userId === exchange.partyBId) {
    return `Party B (${userId})`;
  }
  if (userId === exchange.createdById) {
    return `Creator (${userId})`;
  }
  return userId;
}
