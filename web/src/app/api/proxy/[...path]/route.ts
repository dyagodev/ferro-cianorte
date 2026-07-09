import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { laravelApiUrl } from "@/lib/laravel";
import { TOKEN_COOKIE } from "@/lib/session";

async function forward(request: Request, path: string[]) {
  const store = await cookies();
  const token = store.get(TOKEN_COOKIE)?.value;

  if (!token) {
    return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
  }

  const url = new URL(request.url);
  const target = `${laravelApiUrl()}/${path.join("/")}${url.search}`;

  const hasBody = !["GET", "HEAD"].includes(request.method);

  const response = await fetch(target, {
    method: request.method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: hasBody ? await request.text() : undefined,
    cache: "no-store",
  });

  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json") ? await response.json() : await response.text();

  return NextResponse.json(payload, { status: response.status });
}

type Params = { params: Promise<{ path: string[] }> };

export async function GET(request: Request, { params }: Params) {
  return forward(request, (await params).path);
}

export async function POST(request: Request, { params }: Params) {
  return forward(request, (await params).path);
}

export async function PUT(request: Request, { params }: Params) {
  return forward(request, (await params).path);
}

export async function DELETE(request: Request, { params }: Params) {
  return forward(request, (await params).path);
}
