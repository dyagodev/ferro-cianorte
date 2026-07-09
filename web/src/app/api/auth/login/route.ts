import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { laravelApiUrl } from "@/lib/laravel";
import { LOJA_COOKIE, NAME_COOKIE, ROLE_COOKIE, TOKEN_COOKIE } from "@/lib/session";

export async function POST(request: Request) {
  const body = await request.json();

  const response = await fetch(`${laravelApiUrl()}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ ...body, device_name: "web" }),
  });

  const data = await response.json();

  if (!response.ok) {
    return NextResponse.json(data, { status: response.status });
  }

  const store = await cookies();
  const cookieOptions = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  };

  store.set(TOKEN_COOKIE, data.token, cookieOptions);
  store.set(ROLE_COOKIE, data.user.role, cookieOptions);
  store.set(LOJA_COOKIE, String(data.user.loja_id ?? ""), cookieOptions);
  store.set(NAME_COOKIE, data.user.name, cookieOptions);

  return NextResponse.json({ user: data.user });
}
