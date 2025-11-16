import type { ReactNode } from "react";

export type ExchangeListItem = {
  id: string;
  name: string;
  status?: string;
  counterpart?: string;
  asset?: string;
  lastUpdated?: string;
  tags?: string[];
};

type ExchangeListProps = {
  exchanges: ExchangeListItem[];
  onSelect?: (exchange: ExchangeListItem) => void;
  actionLabel?: string;
  emptyState?: ReactNode;
  className?: string;
};

const badgeBase =
  "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium";

export function ExchangeList({
  exchanges,
  onSelect,
  actionLabel = "View details",
  emptyState,
  className,
}: ExchangeListProps) {
  const containerClass = ["space-y-3", className].filter(Boolean).join(" ");

  if (!exchanges.length) {
    return (
      <div className={containerClass}>
        {emptyState ?? (
          <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center">
            <p className="text-sm font-medium text-zinc-700">No exchanges yet</p>
            <p className="mt-1 text-sm text-zinc-500">Start by drafting your first exchange.</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={containerClass}>
      {exchanges.map((exchange) => {
        const Wrapper = onSelect ? "button" : "article";
        const handleClick = () => onSelect?.(exchange);

        return (
          <Wrapper
            key={exchange.id}
            type={onSelect ? "button" : undefined}
            onClick={onSelect ? handleClick : undefined}
            className="w-full rounded-xl border border-zinc-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-semibold text-zinc-900">{exchange.name}</h3>
                  {exchange.status ? (
                    <span className={`${badgeBase} border-indigo-200 bg-indigo-50 text-indigo-700`}>
                      {exchange.status}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-zinc-500">
                  {exchange.counterpart ? (
                    <>
                      With <span className="font-medium text-zinc-700">{exchange.counterpart}</span>
                    </>
                  ) : (
                    "Awaiting counterpart"
                  )}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-zinc-500">
                  {exchange.asset ? (
                    <span className="font-medium text-zinc-700">{exchange.asset}</span>
                  ) : null}
                  {exchange.lastUpdated ? <span>Updated {exchange.lastUpdated}</span> : null}
                </div>
                {exchange.tags?.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {exchange.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="flex items-center gap-2 self-start text-sm font-medium text-indigo-600">
                <span>{actionLabel}</span>
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 4.5 13 10l-5.5 5.5" />
                </svg>
              </div>
            </div>
          </Wrapper>
        );
      })}
    </div>
  );
}
