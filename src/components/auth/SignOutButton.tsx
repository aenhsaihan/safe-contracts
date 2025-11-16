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
      await signOut();
      router.push("/signin");
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

