type ExchangeSummary = {
  id: string;
  title: string;
  counterpart: string;
  status: "PENDING" | "COMPLETED" | "ACTION_REQUIRED";
  updatedAt: string;
  fileCount: number;
  latestFileTimestamp?: string | null;
};

interface ExchangeListProps {
  exchanges: ExchangeSummary[];
}

const statusColors: Record<ExchangeSummary["status"], string> = {
  PENDING: "text-amber-600 bg-amber-50 border-amber-200",
  COMPLETED: "text-emerald-700 bg-emerald-50 border-emerald-200",
  ACTION_REQUIRED: "text-rose-700 bg-rose-50 border-rose-200",
};

export default function ExchangeList({ exchanges }: ExchangeListProps) {
  return (
    <section className="space-y-4 rounded-2xl border border-zinc-200 bg-white/80 p-6 shadow-sm backdrop-blur">
      <header>
        <p className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Active exchanges
        </p>
      </header>

      <div className="divide-y divide-zinc-100">
        {exchanges.map((exchange) => (
          <article key={exchange.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-base font-semibold text-zinc-900">{exchange.title}</p>
              <p className="text-sm text-zinc-500">
                Counterparty:{" "}
                <span className="font-medium text-zinc-800">{exchange.counterpart}</span>
              </p>
              <p className="text-xs text-zinc-400">
                Updated {new Date(exchange.updatedAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </p>
              {exchange.latestFileTimestamp && (
                <p className="text-xs text-zinc-400">
                  Last file {formatRecentFileTimestamp(exchange.latestFileTimestamp)}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                {exchange.fileCount} {exchange.fileCount === 1 ? "file" : "files"}
              </span>
              <span
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusColors[exchange.status]}`}
              >
                {exchange.status.replace("_", " ")}
              </span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function formatRecentFileTimestamp(input: string | null | undefined) {
  if (!input) {
    return "";
  }

  const value = new Date(input);
  if (Number.isNaN(value.getTime())) {
    return "";
  }

  return value.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
