import Link from "next/link";
import { notFound } from "next/navigation";

import { getDataClientServerSide, runWithAmplifyServerContext } from "@/lib/amplify-server";

type PageParams = { id: string };

type ExchangeParticipants = {
  partyAId: string;
  partyBId: string;
  createdById: string;
};

export default async function ExchangeDetailPage({
  params,
}: {
  params: PageParams | Promise<PageParams>;
}) {
  const resolvedParams = await params;
  const exchangeId = decodeURIComponent(resolvedParams.id);

  const dataClient = getDataClientServerSide();

  const exchangeResponse = await runWithAmplifyServerContext({
    operation: () => dataClient.models.ContractExchange.get({ id: exchangeId }),
  });

  if (exchangeResponse.errors?.length) {
    const message = exchangeResponse.errors.map((error) => error.message).join("; ");
    throw new Error(`Unable to load exchange ${exchangeId}: ${message}`);
  }

  const exchange = exchangeResponse.data;

  if (!exchange) {
    notFound();
  }

  const filesResponse = await runWithAmplifyServerContext({
    operation: () =>
      dataClient.models.ContractFile.list({
        filter: {
          exchangeId: { eq: exchangeId },
        },
      }),
  });

  if (filesResponse.errors?.length) {
    const message = filesResponse.errors.map((error) => error.message).join("; ");
    throw new Error(`Unable to load files for exchange ${exchangeId}: ${message}`);
  }

  const files = [...(filesResponse.data ?? [])].sort((left, right) => {
    const leftDate = new Date(left.createdAt ?? left.updatedAt ?? 0).getTime();
    const rightDate = new Date(right.createdAt ?? right.updatedAt ?? 0).getTime();
    return rightDate - leftDate;
  });

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col gap-8 px-6 py-10">
      <div className="text-sm text-zinc-500">
        <Link href="/" className="font-medium text-sky-600 hover:underline">
          ← Back to dashboard
        </Link>
      </div>

      <section className="space-y-4 rounded-3xl border border-zinc-200 bg-white/90 p-6 shadow-sm backdrop-blur">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Exchange detail
            </p>
            <h1 className="text-2xl font-semibold text-zinc-900">{exchange.title}</h1>
            <p className="text-sm text-zinc-500">
              Party A • <span className="font-mono text-xs">{exchange.partyAId}</span>
            </p>
            <p className="text-sm text-zinc-500">
              Party B • <span className="font-mono text-xs">{exchange.partyBId}</span>
            </p>
          </div>
          <span className="inline-flex items-center rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-sky-700">
            {(exchange.status ?? "PENDING").replace("_", " ")}
          </span>
        </div>

        <dl className="grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Exchange ID</dt>
            <dd className="font-mono text-sm text-zinc-800">{exchange.id}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Created</dt>
            <dd className="text-sm text-zinc-800">{formatDateLabel(exchange.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Last updated
            </dt>
            <dd className="text-sm text-zinc-800">{formatDateLabel(exchange.updatedAt)}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-3xl border border-zinc-200 bg-white/90 p-6 shadow-sm backdrop-blur">
        <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
          <div>
            <p className="text-sm font-semibold text-zinc-900">Encrypted files</p>
            <p className="text-sm text-zinc-500">Showing cryptographic metadata for each upload</p>
          </div>
          <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            {files.length} stored
          </span>
        </div>

        <div className="divide-y divide-zinc-100">
          {files.map((file) => {
            const uploadedAt = formatDateLabel(file.createdAt ?? file.updatedAt);
            const owner = describeParticipant(file.ownerId, exchange);
            const uploader = describeParticipant(file.uploaderId, exchange);
            const hashSnippet = (file.fileHash ?? "").slice(0, 10);

            return (
              <article key={file.id} className="py-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-base font-semibold text-zinc-900">{file.fileName}</p>
                    <p className="text-sm text-zinc-500">
                      Owner: <span className="font-medium text-zinc-800">{owner}</span> · Uploaded by{" "}
                      <span className="font-medium text-zinc-800">{uploader}</span>
                    </p>
                    <p className="text-xs text-zinc-400">{uploadedAt}</p>
                    <p className="font-mono text-xs text-zinc-500">
                      SHA-256: {hashSnippet || "unavailable"}
                    </p>
                  </div>
                  <div className="text-sm text-zinc-500">
                    <p>
                      File size: <span className="font-medium text-zinc-800">{formatFileSize(file.fileSize)}</span>
                    </p>
                    <p>
                      S3 key: <span className="font-mono text-[11px] text-zinc-700">{file.s3Key}</span>
                    </p>
                  </div>
                </div>
              </article>
            );
          })}

          {files.length === 0 && (
            <p className="py-10 text-center text-sm text-zinc-500">
              No files have been uploaded to this exchange yet.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

function describeParticipant(userId: string, exchange: ExchangeParticipants) {
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

function formatDateLabel(input?: string | null) {
  if (!input) {
    return "Unknown";
  }

  const value = new Date(input);
  if (Number.isNaN(value.getTime())) {
    return "Unknown";
  }

  return value.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatFileSize(bytes: number | null | undefined) {
  if (!Number.isFinite(bytes ?? NaN) || !bytes) {
    return "0 B";
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(1)} ${units[unitIndex]}`;
}
