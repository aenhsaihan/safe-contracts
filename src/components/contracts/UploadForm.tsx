'use client';

import { FormEvent, useState } from "react";

type UploadFormProps = {
  title?: string;
  description?: string;
  accept?: string;
  multiple?: boolean;
  isSubmitting?: boolean;
  helperText?: string;
  onSubmit?: (payload: { file: File | null; files: File[]; notes: string }) => void;
};

export function UploadForm({
  title = "Upload contract",
  description = "Attach a draft agreement or supporting document to keep everything in one place.",
  accept,
  multiple,
  isSubmitting,
  helperText = "PDF, DOCX, or ZIP up to 25 MB.",
  onSubmit,
}: UploadFormProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [notes, setNotes] = useState("");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit?.({ file: files[0] ?? null, files, notes });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"
    >
      <div>
        <p className="text-sm uppercase tracking-wide text-zinc-400">Contracts</p>
        <h3 className="text-xl font-semibold text-zinc-900">{title}</h3>
        {description ? <p className="mt-2 text-sm text-zinc-600">{description}</p> : null}
      </div>

      <label className="block rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center transition hover:border-zinc-400">
        <input
          type="file"
          className="sr-only"
          accept={accept}
          multiple={multiple}
          onChange={(event) => {
            const selectedFiles = Array.from(event.target.files ?? []);
            setFiles(selectedFiles);
          }}
        />
        <div className="space-y-2">
          <p className="text-sm font-medium text-zinc-800">Click to select a file</p>
          <p className="text-xs text-zinc-500">{helperText}</p>
          {files.length ? (
            <div className="rounded-lg bg-white px-3 py-2 text-sm text-zinc-700 shadow-sm">
              {files.length === 1 ? files[0].name : `${files.length} files selected`}
            </div>
          ) : null}
        </div>
      </label>

      <div>
        <label htmlFor="upload-notes" className="text-sm font-medium text-zinc-800">
          Notes
        </label>
        <p className="text-xs text-zinc-500">Add context for reviewers (optional).</p>
        <textarea
          id="upload-notes"
          rows={4}
          className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="Share negotiation history, blocking issues, or signature requirements."
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        {files.length ? (
          <p className="text-sm text-zinc-500">Ready to upload {files.length} file(s).</p>
        ) : (
          <p className="text-sm text-zinc-500">You can submit without notes to keep a placeholder.</p>
        )}
        <button
          type="submit"
          className="inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Uploading…" : "Upload"}
        </button>
      </div>
    </form>
  );
}
