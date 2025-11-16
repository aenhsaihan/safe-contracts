import ExchangeDetail from "@/components/exchanges/ExchangeDetail";
import ExchangeList from "@/components/exchanges/ExchangeList";

const mockExchanges = [
  {
    id: "exc-01",
    title: "Series A Subscription Agreement",
    counterpart: "Atlas Ventures",
    status: "ACTION_REQUIRED" as const,
    updatedAt: "2024-06-10T13:10:00.000Z",
    fileCount: 3,
  },
  {
    id: "exc-02",
    title: "Supply Agreement Renewal",
    counterpart: "Northwind Manufacturing",
    status: "PENDING" as const,
    updatedAt: "2024-06-07T09:12:00.000Z",
    fileCount: 1,
  },
  {
    id: "exc-03",
    title: "Global Payroll Services",
    counterpart: "Contoso Payroll",
    status: "COMPLETED" as const,
    updatedAt: "2024-06-01T18:30:00.000Z",
    fileCount: 4,
  },
];

const activeExchange = {
  id: "exc-01",
  title: "Series A Subscription Agreement",
  partyA: "Safe Contracts Inc.",
  partyB: "Atlas Ventures",
  status: "ACTION_REQUIRED" as const,
  createdAt: "2024-05-30T10:00:00.000Z",
};

const activeFiles = [
  {
    id: "file-nda",
    fileName: "Signed-NDA.pdf",
    fileSize: 148000,
    owner: "My copy",
    uploader: "You",
    uploadedAt: "2024-06-09T15:22:00.000Z",
    sha256: "06ade1a1496654d5c2e1ba4cb322dcf8f62107d096dbc2485756d8b512df40d4",
    base64: "U2lnbmVkIE5EQSBEb2N1bWVudCB2MQ==",
  },
  {
    id: "file-risk",
    fileName: "Risk-Assessment.docx",
    fileSize: 89000,
    owner: "Counterparty copy",
    uploader: "Atlas Ventures",
    uploadedAt: "2024-06-08T11:05:00.000Z",
    sha256: "c47d9a22c636061c7398db8bdb3198d4849dc5b647a742a76b8d994571fda853",
    base64: "Q291bnRlcnBhcnR5IFJpc2sgQXNzZXNzbWVudCAyMDI0",
  },
  {
    id: "file-payment",
    fileName: "Payment-Terms.pdf",
    fileSize: 204000,
    owner: "Counterparty copy",
    uploader: "Atlas Ventures",
    uploadedAt: "2024-06-07T08:40:00.000Z",
    sha256: "435e8b2109a3146de5269197cebd69fc3ef55cb110e4f8a0436871862e79a94a",
    base64: "UGF5bWVudCBUZXJtcyBBZGRlbmR1bSBkcmFmdA==",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white py-10">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6">
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
        </section>

        <ExchangeList exchanges={mockExchanges} />

        <ExchangeDetail exchange={activeExchange} files={activeFiles} />
      </main>
    </div>
  );
}
