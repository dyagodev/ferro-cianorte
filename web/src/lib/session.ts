import { cookies } from "next/headers";

export const TOKEN_COOKIE = "pdv_token";
export const ROLE_COOKIE = "pdv_role";
export const LOJA_COOKIE = "pdv_loja_id";
export const NAME_COOKIE = "pdv_name";

export type Role = "admin" | "vendedor";

export type Session = {
  token: string;
  role: Role;
  lojaId: number | null;
  nome: string;
};

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const token = store.get(TOKEN_COOKIE)?.value;
  const role = store.get(ROLE_COOKIE)?.value as Role | undefined;

  if (!token || !role) {
    return null;
  }

  const lojaIdRaw = store.get(LOJA_COOKIE)?.value;

  return {
    token,
    role,
    lojaId: lojaIdRaw ? Number(lojaIdRaw) : null,
    nome: store.get(NAME_COOKIE)?.value ?? "",
  };
}
