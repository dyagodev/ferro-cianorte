export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, body: unknown) {
    super(typeof body === "object" && body && "message" in body ? String((body as { message: unknown }).message) : "Erro na requisição");
    this.status = status;
    this.body = body;
  }
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  // FormData (upload de arquivo) precisa que o navegador defina o
  // Content-Type sozinho (multipart/form-data com o boundary embutido) —
  // se a gente forçar "application/json" aqui, o multipart quebra.
  const isFormData = options.body instanceof FormData;

  const response = await fetch(`/api/proxy/${path}`, {
    ...options,
    headers: isFormData ? options.headers : { "Content-Type": "application/json", ...options.headers },
  });

  const contentType = response.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json") ? await response.json() : await response.text();

  if (!response.ok) {
    throw new ApiError(response.status, body);
  }

  return body as T;
}
