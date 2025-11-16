"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";

export type CreateExchangeFormState = {
  success: boolean;
  message?: string;
  error?: string;
};

const initialFormState: CreateExchangeFormState = {
  success: false,
};

type CreateExchangeFormProps = {
  action: (
    prevState: CreateExchangeFormState,
    formData: FormData
  ) => Promise<CreateExchangeFormState>;
};

export function CreateExchangeForm({ action }: CreateExchangeFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [formState, formAction] = useActionState(action, initialFormState);

  useEffect(() => {
    if (formState.success) {
      formRef.current?.reset();
    }
  }, [formState.success]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex flex-col gap-6 rounded-2xl border border-zinc-100 bg-zinc-50/70 p-6"
    >
      <div className="flex flex-col gap-2">
        <label htmlFor="title" className="text-sm font-medium text-zinc-800">
          Exchange title
        </label>
        <input
          id="title"
          name="title"
          type="text"
          required
          placeholder="Series A subscription agreement"
          className="rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-base text-zinc-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
        />
        <p className="text-sm text-zinc-500">
          Something the both of you will recognize in your dashboards.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="partyBEmail" className="text-sm font-medium text-zinc-800">
          Counterparty identifier
        </label>
        <input
          id="partyBEmail"
          name="partyBEmail"
          type="text"
          required
          placeholder="counterparty@example.com"
          className="rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-base text-zinc-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
        />
        <p className="text-sm text-zinc-500">
          For the MVP this is just a string field. Drop in their Cognito sub or email.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {formState.error ? (
          <p className="text-sm text-rose-600">{formState.error}</p>
        ) : null}
        {formState.success && formState.message ? (
          <p className="text-sm text-emerald-600">{formState.message}</p>
        ) : null}
        <SubmitButton />
      </div>
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center justify-center rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white shadow hover:bg-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-400 disabled:cursor-not-allowed disabled:bg-sky-300"
    >
      {pending ? "Creating exchange..." : "Create exchange"}
    </button>
  );
}

