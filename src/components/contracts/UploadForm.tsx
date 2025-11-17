"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { uploadExchangeFileAction } from "@/app/exchanges/[id]/actions";

type OwnerSelection = "PARTY_A" | "PARTY_B";

interface UploadFormProps {
  exchangeId: string;
  currentUserId: string;
  partyAId: string;
  partyBId: string;
  partyALabel?: string;
  partyBLabel?: string;
}

export default function UploadForm({
  exchangeId,
  currentUserId,
  partyAId,
  partyBId,
  partyALabel,
  partyBLabel,
}: UploadFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const viewerRole = useMemo<OwnerSelection | null>(() => {
    if (currentUserId === partyAId) {
      return "PARTY_A";
    }
    if (currentUserId === partyBId) {
      return "PARTY_B";
    }
    return null;
  }, [currentUserId, partyAId, partyBId]);
  const [selectedOwner, setSelectedOwner] = useState<OwnerSelection>(viewerRole ?? "PARTY_A");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hashHex, setHashHex] = useState<string | null>(null);
  const viewerHasAccess = Boolean(viewerRole);

  const ownerOptions = useMemo(
    () => [
      {
        key: "PARTY_A" as const,
        id: partyAId,
        label: partyALabel || "Party A",
      },
      {
        key: "PARTY_B" as const,
        id: partyBId,
        label: partyBLabel || "Party B",
      },
    ],
    [partyAId, partyBId, partyALabel, partyBLabel]
  );

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

    if (!viewerHasAccess) {
      setError("You no longer have permission to upload to this exchange.");
      return;
    }

    const ownerId = selectedOwner === "PARTY_A" ? partyAId : partyBId;
    if (!ownerId) {
      setError("Unable to determine file ownership for this upload.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setHashHex(null);

    try {
      const fileBase64 = await fileToBase64(selectedFile);
      const trimmedDescription = description.trim();

      const result = await uploadExchangeFileAction({
        exchangeId,
        ownerId,
        uploaderId: currentUserId,
        fileName: selectedFile.name || "unnamed-file",
        fileSize: selectedFile.size,
        fileType: selectedFile.type || undefined,
        fileBase64,
        description: trimmedDescription || undefined,
      });

      setHashHex(result.fileHash);
      setSelectedFile(null);
      setDescription("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      // Status update is now handled automatically in uploadExchangeFileAction
      // after checking if both parties have uploaded
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed. Try again shortly.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!viewerHasAccess) {
    return (
      <div className="space-y-3 rounded-2xl border border-dashed border-rose-200 bg-rose-50/70 p-6 text-sm text-rose-700">
        <p className="font-semibold">Uploads disabled</p>
        <p>You must be Party A or Party B on this exchange to upload encrypted files.</p>
      </div>
    );
  }

  const viewerLabel = viewerRole ? (viewerRole === "PARTY_A" ? "Party A" : "Party B") : null;

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
        {viewerLabel && (
          <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-sky-600">
            You are {viewerLabel} on this exchange
          </p>
        )}
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
        <legend className="px-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Ownership
        </legend>
        <p className="mb-2 text-xs text-zinc-500">Choose whose executed copy you&apos;re uploading.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {ownerOptions.map((option) => {
            const isViewer = option.id === currentUserId;
            const isSelected = selectedOwner === option.key;
            return (
              <label
                key={option.key}
                className={`flex flex-col gap-1 rounded-lg border px-3 py-2 text-sm text-zinc-700 transition ${
                  isSelected ? "border-sky-500 bg-sky-50" : "border-zinc-200"
                }`}
              >
                <span className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="owner"
                    value={option.key}
                    checked={isSelected}
                    onChange={() => setSelectedOwner(option.key)}
                  />
                  <span className="font-semibold">{option.label}</span>
                </span>
                <span className="text-xs text-zinc-500">
                  {isViewer ? "You" : "Counterparty"} •
                  <span className="ml-1 font-mono text-[11px] text-zinc-400">{option.id}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <label className="flex flex-col gap-2 text-sm font-medium text-zinc-600">
        Description (optional)
        <textarea
          className="min-h-[72px] rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-normal text-zinc-700 focus:border-sky-500 focus:outline-none"
          placeholder="Add context about signatures, version, or revisions"
          maxLength={500}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
        <span className="text-xs text-zinc-400">Up to 500 characters.</span>
      </label>

      <button
        type="submit"
        disabled={!selectedFile || isSubmitting}
        className="w-full rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-sky-200"
      >
                {isSubmitting ? "Encrypting..." : "Upload with KMS envelope"}
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
