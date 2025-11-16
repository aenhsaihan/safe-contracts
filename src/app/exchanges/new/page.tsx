import Link from "next/link";
import { revalidatePath } from "next/cache";
import { useEffect, useRef } from "react";
import { useFormState, useFormStatus } from "react-dom";

import {
  getCurrentUserServerSide,
  getDataClientServerSide,
  runWithAmplifyServerContext,
} from "@/lib/amplify-server";

type CreateExchangeFormState = {
  success: boolean;
  message?: string;
  error?: string;
};

const initialFormState: CreateExchangeFormState = {
  success: false,
};

async function createExchangeAction(
  _prevState: CreateExchangeFormState,
  formData: FormData
): Promise<CreateExchangeFormState> {
  "use server";

  const title = formData.get("title");
  const partyBEmail = formData.get("partyBEmail");

  const normalizedTitle = typeof title === "string" ? title.trim() : "";
  const normalizedPartyBEmail =
    typeof partyBEmail === "string" ? partyBEmail.trim() : "";

  if (!normalizedTitle) {
    return {
      success: false,
      error: "Provide a title for the exchange.",
    };
  }

  if (!normalizedPartyBEmail) {
    return {
      success: false,
      error: "Enter the counterparty email/ID so we know who to invite.",
    };
  }

  const currentUser = await getCurrentUserServerSide();

  if (!currentUser?.userId) {
    return {
      success: false,
      error: "You must be signed in to create an exchange.",
    };
  }

  const partyAId = currentUser.userId;
  const dataClient = getDataClientServerSide();

  try {
    const creationResult = await runWithAmplifyServerContext({
      operation: async () =>
        dataClient.models.ContractExchange.create({
          title: normalizedTitle,
          partyAId,
          partyBId: normalizedPartyBEmail,
          createdById: partyAId,
          status: "PENDING",
        }),
    });

    if (creationResult.errors?.length) {
      return {
        success: false,
        error: creationResult.errors[0]?.message ?? "Unable to create exchange.",
      };
    }

    if (!creationResult.data) {
      return {
        success: false,
        error: "Exchange creation returned an empty response.",
      };
    }

    revalidatePath("/");

    return {
      success: true,
      message: `Exchange "${creationResult.data.title}" created.`,
    };
  } catch (error) {
    console.error("Failed to create exchange", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create exchange.",
    };
  }
}

export default function NewExchangePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white py-10">
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6">
        <Link
          href="/"
          className="text-sm font-medium text-sky-600 transition hover:text-sky-700"
        >
          ← Back to dashboard
        </Link>

        <section className="rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-600">
            Create exchange
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-zinc-900">
            Start a new encrypted exchange
          </h1>
          <p className="mt-3 text-base text-zinc-600">
            Define the title and who you{"'"}re exchanging with. We{"'"}ll provision the
            record, set you as party A, and leave the exchange in a pending
            state until files begin flowing.
          </p>

          <div className="mt-8">
            <CreateExchangeForm />
          </div>
        </section>
      </main>
    </div>
  );
}

function CreateExchangeForm() {
  "use client";

  const formRef = useRef<HTMLFormElement>(null);
  const [formState, formAction] = useFormState(createExchangeAction, initialFormState);

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
        <label
          htmlFor="partyBEmail"
          className="text-sm font-medium text-zinc-800"
        >
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
  "use client";
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
