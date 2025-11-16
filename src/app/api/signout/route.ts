import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST() {
  const store = cookies();
  for (const cookie of store.getAll()) {
    store.delete(cookie.name);
  }
  return NextResponse.json({ ok: true });
}

