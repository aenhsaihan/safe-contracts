import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import NavBar from "@/components/layout/NavBar";
import { Auth } from "@/components/auth/Auth";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Safe Contracts",
  description: "Encrypted file exchanges with verifiable integrity checks.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  try {
    return (
      <html lang="en">
        <body
          className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-zinc-50 antialiased`}
        >
          <Auth>
            <NavBar />
            {children}
          </Auth>
        </body>
      </html>
    );
  } catch (error) {
    console.error("[RootLayout] Error:", error);
    // Return a minimal layout if there's an error
    return (
      <html lang="en">
        <body className="min-h-screen bg-zinc-50 p-8">
          <div className="rounded-lg border border-red-200 bg-white p-6">
            <h1 className="text-xl font-semibold text-red-900">Configuration Error</h1>
            <p className="mt-2 text-sm text-red-700">
              {error instanceof Error ? error.message : "An error occurred during initialization"}
            </p>
            <pre className="mt-4 overflow-auto rounded bg-red-50 p-2 text-xs">
              {error instanceof Error ? error.stack : String(error)}
            </pre>
          </div>
        </body>
      </html>
    );
  }
}
