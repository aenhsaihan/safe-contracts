"use client";

import { FormEvent, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { uploadExchangeFileAction } from "@/app/exchanges/[id]/actions";
import { markExchangeCompletedAction } from "@/app/exchanges/actions";

type OwnerSelection = "MY_COPY" | "THEIR_COPY";

interface UploadFormProps {
  exchangeId: string;
  currentUserId: string;
  counterpartyId: string;
}

export default function UploadForm({ exchangeId, currentUserId, counterpartyId }: UploadFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedOwner, setSelectedOwner] = useState<OwnerSelection>("MY_COPY");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isStatusUpdating, startStatusUpdate] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [hashHex, setHashHex] = useState<string | null>(null);

  const hashSnippet = useMemo(() => {
    if (!hashHex) {
      return null;
    }
    return `${hashHex.slice(0, 8)}...${hashHex.slice(-4)}`;
  }, [hashHex]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedFile) {
      setError("Select a file before uploading.");
      return;
    }

    const ownerId = selectedOwner === "MY_COPY" ? currentUserId : counterpartyId;
    if (!ownerId) {
      setError("Unable to determine file ownership for this upload.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setHashHex(null);

    try {
      const fileBase64 = await fileToBase64(selectedFile);

      const result = await uploadExchangeFileAction({
        exchangeId,
        ownerId,
        uploaderId: currentUserId,
        fileName: selectedFile.name || "unnamed-file",
        fileSize: selectedFile.size,
        fileType: selectedFile.type || undefined,
        fileBase64,
      });

      setHashHex(result.fileHash);
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      startStatusUpdate(async () => {
        try {
          await markExchangeCompletedAction(exchangeId);
        } catch (updateError) {
          console.error("Failed to mark exchange as completed", updateError);
        } finally {
          router.refresh();
        }
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed. Try again shortly.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      className="space-y-4 rounded-2xl border border-zinc-200 bg-white/80 p-6 shadow-sm backdrop-blur"
      onSubmit={handleSubmit}
    >
      <div>
        <p className="text-sm font-semibold text-zinc-900">Upload encrypted file</p>
        <p className="text-sm text-zinc-500">
          Files are wrapped by KMS envelope encryption before leaving your browser.
        </p>
      </div>

      <label className="flex flex-col gap-2 text-sm font-medium text-zinc-600">
        Select file
        <input
          ref={fileInputRef}
          type="file"
          className="rounded-lg border border-dashed border-zinc-300 bg-white px-4 py-3 text-sm font-normal text-zinc-700 focus:border-sky-500 focus:outline-none"
          onChange={(event) => {
            const file = event.target.files?.[0] ?? null;
            setSelectedFile(file);
            setError(null);
            setHashHex(null);
          }}
        />
      </label>

      <fieldset className="rounded-lg border border-zinc-200 p-3">
        <legend className="px-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Ownership</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700">
            <input
              type="radio"
              name="owner"
              value="MY_COPY"
              checked={selectedOwner === "MY_COPY"}
              onChange={() => setSelectedOwner("MY_COPY")}
            />
            My copy
          </label>
          <label className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700">
            <input
              type="radio"
              name="owner"
              value="THEIR_COPY"
              checked={selectedOwner === "THEIR_COPY"}
              onChange={() => setSelectedOwner("THEIR_COPY")}
            />
            Counterparty copy
          </label>
        </div>
      </fieldset>

      <button
        type="submit"
        disabled={!selectedFile || isSubmitting || isStatusUpdating}
        className="w-full rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-sky-200"
      >
        {isSubmitting ? "Encrypting..." : isStatusUpdating ? "Finalizing..." : "Upload with KMS envelope"}
      </button>

      {error && <p className="text-sm text-rose-600">{error}</p>}

      {hashSnippet && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <p className="font-semibold">File stored with KMS envelope encryption</p>
          <p className="mt-1 font-mono text-xs tracking-wide">SHA-256: {hashSnippet}</p>
        </div>
      )}
    </form>
  );
}

async function fileToBase64(file: File) {
  const buffer = await file.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}
