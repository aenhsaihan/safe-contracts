import Link from "next/link";

import { getCurrentUserServerSide } from "@/lib/amplify-server";

const navLinkClasses = "text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900";
const buttonClasses =
  "rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50";

export default async function NavBar() {
  const currentUser = await getCurrentUserServerSide().catch(() => null);
  const isAuthenticated = Boolean(currentUser);
  const displayName = currentUser?.username ?? currentUser?.userId ?? "";

  return (
    <header className="border-b border-zinc-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-8">
          <Link href="/" className="text-lg font-semibold text-zinc-900">
            Safe Contracts
          </Link>

          <nav className="flex items-center gap-6">
            <Link href="/" className={navLinkClasses}>
              Dashboard
            </Link>
            <Link href="/exchanges/new" className={navLinkClasses}>
              New Exchange
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-4">
          {isAuthenticated ? (
            <>
              <span className="text-sm text-zinc-500">
                Signed in as {" "}
                <span className="font-medium text-zinc-800">{displayName}</span>
              </span>
              <form action="/api/auth/signout" method="post">
                <button type="submit" className={buttonClasses}>
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <Link href="/signin" className={buttonClasses}>
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
