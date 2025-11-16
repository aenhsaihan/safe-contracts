import Link from "next/link";

import { getCurrentUserServerSide } from "@/lib/amplify-server";
import {
  ContractExchangeRecord,
  listContractExchangesForUser,
} from "@/lib/contracts-data";

type ExchangeRecord = ContractExchangeRecord;

export default async function DashboardPage() {
  const currentUser = await getCurrentUserServerSide();
  const userId = currentUser?.userId ?? null;
  const exchanges = userId ? await fetchExchangesForUser(userId) : [];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white py-10">
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6">
        <section className="rounded-3xl border border-zinc-200 bg-white/90 p-8 shadow-sm backdrop-blur">
          <p className="text-sm font-semibold uppercase tracking-wide text-sky-600">
            Safe Contracts dashboard
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-zinc-900">
            End-to-end encrypted exchanges with built-in trust signals
          </h1>
          <p className="mt-3 max-w-3xl text-base text-zinc-600">
            Every upload is wrapped with KMS envelope encryption, hashed with SHA-256, and verified on
            download so counterparties can trust the chain of custody.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/exchanges/new"
              className="inline-flex items-center rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-500"
            >
              Start a new exchange
            </Link>
            <Link
              href="/"
              className="inline-flex items-center rounded-xl border border-transparent px-4 py-2 text-sm font-semibold text-sky-700 transition hover:border-sky-200 hover:bg-sky-50"
            >
              Refresh dashboard
            </Link>
          </div>
        </section>

        {userId ? (
          <ExchangeList exchanges={exchanges} />
        ) : (
          <section className="rounded-2xl border border-dashed border-zinc-200 bg-white/70 p-6 text-center text-sm text-zinc-600">
            Sign in to see encrypted exchanges you{"'"}re a participant in.
          </section>
        )}
      </main>
    </div>
  );
}

async function fetchExchangesForUser(userId: string) {
  const list = await listContractExchangesForUser(userId);

  return [...list].sort((left, right) => {
    const leftDate = new Date(left.createdAt ?? left.updatedAt ?? 0).getTime();
    const rightDate = new Date(right.createdAt ?? right.updatedAt ?? 0).getTime();
    return rightDate - leftDate;
  });
}

function ExchangeList({ exchanges }: { exchanges: ExchangeRecord[] }) {
  if (exchanges.length === 0) {
    return (
      <section className="rounded-2xl border border-zinc-200 bg-white/80 p-6 shadow-sm backdrop-blur">
        <header className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Your exchanges
            </p>
            <h2 className="text-xl font-semibold text-zinc-900">No exchanges yet</h2>
          </div>
          <Link
            href="/exchanges/new"
            className="inline-flex items-center rounded-lg border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:border-sky-600 hover:text-sky-700"
          >
            Create your first exchange
          </Link>
        </header>
        <p className="text-sm text-zinc-600">
          Kick off a new workflow to invite a counterparty and start exchanging encrypted files.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white/80 p-6 shadow-sm backdrop-blur">
      <header className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Your exchanges
          </p>
          <h2 className="text-xl font-semibold text-zinc-900">
            {exchanges.length} active {exchanges.length === 1 ? "record" : "records"}
          </h2>
        </div>
        <Link
          href="/exchanges/new"
          className="inline-flex items-center rounded-lg border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:border-sky-600 hover:text-sky-700"
        >
          New exchange
        </Link>
      </header>

      <div className="divide-y divide-zinc-100">
        {exchanges.map((exchange) => (
          <article
            key={exchange.id}
            className="flex flex-col gap-3 py-4 text-sm text-zinc-600 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <h3 className="text-base font-semibold text-zinc-900">{exchange.title}</h3>
              <p>
                Party A: <span className="font-mono text-xs text-zinc-800">{exchange.partyAId}</span>
              </p>
              <p>
                Party B: <span className="font-mono text-xs text-zinc-800">{exchange.partyBId}</span>
              </p>
              <p className="text-xs text-zinc-400">
                Created {formatDateLabel(exchange.createdAt ?? exchange.updatedAt)}
              </p>
            </div>
            <div className="flex flex-col items-start gap-2 sm:items-end">
              <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700">
                {(exchange.status ?? "PENDING").replace("_", " ")}
              </span>
              <Link
                href={`/exchanges/${encodeURIComponent(exchange.id)}`}
                className="text-sm font-semibold text-sky-600 transition hover:text-sky-500"
              >
                View exchange →
              </Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
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
