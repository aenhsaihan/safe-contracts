"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "aws-amplify/auth";

import { ensureAmplifyConfigured } from "@/lib/amplify-client";

type SignOutButtonProps = {
  className?: string;
  children?: React.ReactNode;
};

export function SignOutButton({ className, children }: SignOutButtonProps) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const handleClick = () => {
    startTransition(async () => {
      ensureAmplifyConfigured();
      // Sign out client, clear local storage
      await signOut();
      // Clear the server cookies so SSR sees the next login
      await fetch("/api/signout", { method: "POST" });
      // Always send the user to the Authenticator, even if they were already there
      router.push("/signin");
      router.refresh();
    });
  };

  return (
    <button
      type="button"
      className={className}
      onClick={handleClick}
      disabled={pending}
    >
      {pending ? "Signing out..." : children ?? "Sign out"}
    </button>
  );
}

