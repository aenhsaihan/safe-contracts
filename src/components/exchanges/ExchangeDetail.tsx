import type { ReactNode } from "react";

export type ExchangeHighlight = {
  label: string;
  value: string;
};

export type ExchangeParty = {
  name: string;
  role?: string;
  contact?: string;
};

export type ExchangeEvent = {
  label: string;
  date: string;
  note?: string;
};

type ExchangeDetailProps = {
  title: string;
  description?: string;
  highlights?: ExchangeHighlight[];
  parties?: ExchangeParty[];
  events?: ExchangeEvent[];
  actions?: ReactNode;
  footer?: ReactNode;
  className?: string;
};

export function ExchangeDetail({
  title,
  description,
  highlights = [],
  parties = [],
  events = [],
  actions,
  footer,
  className,
}: ExchangeDetailProps) {
  const containerClass = [
    "rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section className={containerClass}>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-wide text-zinc-400">Exchange</p>
          <h2 className="text-2xl font-semibold text-zinc-900">{title}</h2>
          {description ? <p className="mt-2 text-sm text-zinc-600">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </header>

      {highlights.length ? (
        <dl className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {highlights.map((highlight) => (
            <div
              key={`${highlight.label}-${highlight.value}`}
              className="rounded-xl border border-zinc-100 bg-zinc-50 p-4"
            >
              <dt className="text-xs uppercase tracking-wide text-zinc-500">{highlight.label}</dt>
              <dd className="mt-2 text-lg font-semibold text-zinc-900">{highlight.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {parties.length ? (
        <div className="mt-8">
          <p className="text-sm font-medium text-zinc-700">Parties</p>
          <ul className="mt-3 divide-y divide-zinc-100 rounded-xl border border-zinc-100 bg-zinc-50">
            {parties.map((party) => (
              <li key={party.name} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:justify-between">
                <div>
                  <p className="font-medium text-zinc-900">{party.name}</p>
                  {party.role ? <p className="text-sm text-zinc-600">{party.role}</p> : null}
                </div>
                {party.contact ? (
                  <p className="text-sm text-indigo-600 sm:text-right">{party.contact}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {events.length ? (
        <div className="mt-8">
          <p className="text-sm font-medium text-zinc-700">Timeline</p>
          <ol className="mt-3 space-y-4">
            {events.map((event) => (
              <li key={`${event.label}-${event.date}`} className="flex gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 bg-white text-sm font-semibold text-indigo-600">
                  {event.date}
                </div>
                <div>
                  <p className="font-medium text-zinc-900">{event.label}</p>
                  {event.note ? <p className="text-sm text-zinc-600">{event.note}</p> : null}
                </div>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {footer ? <div className="mt-8 border-t border-zinc-100 pt-6">{footer}</div> : null}
    </section>
  );
}
