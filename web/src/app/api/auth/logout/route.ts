import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { laravelApiUrl } from "@/lib/laravel";
import { LOJA_COOKIE, NAME_COOKIE, ROLE_COOKIE, TOKEN_COOKIE } from "@/lib/session";

export async function POST() {
  const store = await cookies();
  const token = store.get(TOKEN_COOKIE)?.value;

  if (token) {
    await fetch(`${laravelApiUrl()}/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    }).catch(() => undefined);
  }

  store.delete(TOKEN_COOKIE);
  store.delete(ROLE_COOKIE);
  store.delete(LOJA_COOKIE);
  store.delete(NAME_COOKIE);

  return NextResponse.json({ ok: true });
}
