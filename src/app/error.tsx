"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to help with debugging
    console.error("Application error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <div className="max-w-md rounded-xl border border-red-200 bg-white p-6 shadow-lg">
        <h1 className="text-xl font-semibold text-red-900">Application Error</h1>
        <p className="mt-2 text-sm text-red-700">
          {error.message || "An unexpected error occurred"}
        </p>
        {error.digest && (
          <p className="mt-1 text-xs text-red-500">Digest: {error.digest}</p>
        )}
        <button
          onClick={reset}
          className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
        >
          Try again
        </button>
        <details className="mt-4">
          <summary className="cursor-pointer text-xs text-red-600">Error details</summary>
          <pre className="mt-2 overflow-auto rounded bg-red-50 p-2 text-xs">
            {error.stack}
          </pre>
        </details>
      </div>
    </div>
  );
}

