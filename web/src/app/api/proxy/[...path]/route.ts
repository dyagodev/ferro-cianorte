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

  // Repassa o Content-Type original em vez de forçar JSON: upload de
  // certificado (multipart/form-data, com o boundary embutido no header)
  // quebraria se a gente reescrevesse isso — arrayBuffer() é binary-safe
  // tanto pra JSON quanto pra multipart.
  const incomingContentType = request.headers.get("content-type");

  const response = await fetch(target, {
    method: request.method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...(incomingContentType ? { "Content-Type": incomingContentType } : {}),
    },
    body: hasBody ? await request.arrayBuffer() : undefined,
    cache: "no-store",
  });

  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const payload = await response.json();
    return NextResponse.json(payload, { status: response.status });
  }

  // Binário (PDF do DANFE, etc.) — repassa bruto em vez de forçar texto,
  // senão o download vem corrompido (ver baixarDanfe no backend).
  const corpo = await response.arrayBuffer();
  const headers = new Headers({ "Content-Type": contentType || "application/octet-stream" });
  const disposition = response.headers.get("content-disposition");
  if (disposition) headers.set("Content-Disposition", disposition);

  return new NextResponse(corpo, { status: response.status, headers });
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
