"use client";

import { useMemo, useState } from "react";

import UploadForm from "@/components/contracts/UploadForm";

type ExchangeMetadata = {
  id: string;
  title: string;
  partyA: string;
  partyAId: string;
  partyB: string;
  partyBId: string;
  status: "PENDING" | "COMPLETED" | "ACTION_REQUIRED";
  createdAt: string;
};

type FileRecord = {
  id: string;
  fileName: string;
  fileSize: number;
  owner: string;
  uploader: string;
  uploadedAt: string;
  sha256: string;
  base64?: string;
};

type DownloadState = "idle" | "verifying" | "verified" | "failed";

interface ExchangeDetailProps {
  exchange: ExchangeMetadata;
  files: FileRecord[];
  currentUserId: string;
}

export default function ExchangeDetail({ exchange, files, currentUserId }: ExchangeDetailProps) {
  const [downloadStates, setDownloadStates] = useState<Record<string, DownloadState>>({});

  const statusCopy = useMemo(() => {
    switch (exchange.status) {
      case "COMPLETED":
        return "All parties have uploaded their executed copies.";
      case "ACTION_REQUIRED":
        return "Waiting on signatures and uploads from at least one party.";
      default:
        return "Exchange opened. Files remain encrypted until downloaded.";
    }
  }, [exchange.status]);

  const viewerIsPartyA = exchange.partyAId === currentUserId;
  const counterpartyId = viewerIsPartyA ? exchange.partyBId : exchange.partyAId;

  const handleDownload = async (fileId: string) => {
    const file = files.find((entry) => entry.id === fileId);
    if (!file?.base64) {
      setDownloadStates((prev) => ({ ...prev, [fileId]: "failed" }));
      return;
    }

    setDownloadStates((prev) => ({ ...prev, [fileId]: "verifying" }));
    try {
      const buffer = base64ToArrayBuffer(file.base64);
      const hashHex = await sha256Hex(buffer);

      if (hashHex !== file.sha256) {
        setDownloadStates((prev) => ({ ...prev, [fileId]: "failed" }));
        return;
      }

      triggerBrowserDownload(file.fileName, buffer);
      setDownloadStates((prev) => ({ ...prev, [fileId]: "verified" }));
    } catch (error) {
      console.error("Integrity verification failed", error);
      setDownloadStates((prev) => ({ ...prev, [fileId]: "failed" }));
    }
  };

  return (
    <section className="space-y-6 rounded-3xl border border-zinc-200 bg-white/90 p-6 shadow-lg backdrop-blur">
      <header className="space-y-3">
        <p className="text-sm font-semibold text-zinc-500">Exchange detail</p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xl font-semibold text-zinc-900">{exchange.title}</p>
            <p className="text-sm text-zinc-500">
              {exchange.partyA} ↔ {exchange.partyB}
            </p>
          </div>
          <span className="inline-flex items-center rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-sky-700">
            {exchange.status.replace("_", " ")}
          </span>
        </div>
        <p className="text-sm text-zinc-500">{statusCopy}</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[320px,1fr]">
        <UploadForm exchangeId={exchange.id} currentUserId={currentUserId} counterpartyId={counterpartyId} />

        <div className="rounded-2xl border border-zinc-100 bg-white p-4 shadow-inner">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
            <p className="text-sm font-semibold text-zinc-600">Encrypted files</p>
            <p className="text-xs text-zinc-400">{files.length} stored</p>
          </div>
          <div className="divide-y divide-zinc-100">
            {files.map((file) => {
              const hashSnippet = `${file.sha256.slice(0, 8)}...${file.sha256.slice(-4)}`;
              const status = downloadStates[file.id] ?? "idle";

              return (
                <article key={file.id} className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-base font-semibold text-zinc-900">{file.fileName}</p>
                    <p className="text-sm text-zinc-500">
                      {file.owner} · Uploaded by {file.uploader} on{" "}
                      {new Date(file.uploadedAt).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                    <p className="text-xs text-zinc-400">
                      {formatFileSize(file.fileSize)} ·{" "}
                      <span className="font-mono text-xs text-zinc-500">SHA-256: {hashSnippet}</span>
                    </p>
                    {status === "verified" && (
                      <p className="text-sm font-semibold text-emerald-600">Integrity verified</p>
                    )}
                    {status === "failed" && (
                      <p className="text-sm font-semibold text-rose-600">Integrity FAILED</p>
                    )}
                    {status === "verifying" && (
                      <p className="text-sm text-zinc-500">Verifying integrity…</p>
                    )}
                  </div>
                  <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
                    <button
                      className="rounded-xl border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:border-sky-600 hover:text-sky-700"
                      onClick={() => handleDownload(file.id)}
                    >
                      Download & verify
                    </button>
                  </div>
                </article>
              );
            })}
            {files.length === 0 && (
              <p className="py-10 text-center text-sm text-zinc-500">
                No files stored yet. Upload your signed copy to start the audit trail.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

const formatFileSize = (bytes: number) => {
  if (!Number.isFinite(bytes)) {
    return "0 B";
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(1)} ${units[unitIndex]}`;
};

const sha256Hex = async (buffer: ArrayBuffer) => {
  const result = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(result))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

const base64ToArrayBuffer = (base64: string) => {
  const binaryString = atob(base64);
  const length = binaryString.length;
  const bytes = new Uint8Array(length);

  for (let i = 0; i < length; i += 1) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return bytes.buffer;
};

const triggerBrowserDownload = (fileName: string, buffer: ArrayBuffer) => {
  const blob = new Blob([buffer], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
