import Link from "next/link";
import { revalidatePath } from "next/cache";
import { getCurrentUserServerSide } from "@/lib/amplify-server";
import {
  CreateExchangeForm,
  type CreateExchangeFormState,
} from "@/components/exchanges/CreateExchangeForm";
import { createContractExchangeRecord } from "@/lib/contracts-data";

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
  try {
    const exchange = await createContractExchangeRecord({
      title: normalizedTitle,
      partyAId,
      partyBId: normalizedPartyBEmail,
      createdById: partyAId,
      status: "PENDING",
    });

    revalidatePath("/");

    return {
      success: true,
      message: `Exchange "${exchange.title}" created.`,
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
            <CreateExchangeForm action={createExchangeAction} />
          </div>
        </section>
      </main>
    </div>
  );
}
