"use client";

import { AlertCircle, Plus, ShieldCheck, UserRound, UsersRound } from "lucide-react";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/apiClient";
import type { Loja } from "@/lib/types";

type Funcionario = { id: number; name: string; email: string; role: "admin" | "vendedor"; loja_id: number | null };

export default function FuncionariosPage() {
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "vendedor">("vendedor");
  const [lojaId, setLojaId] = useState<string>("");
  const [erro, setErro] = useState<string | null>(null);

  async function carregar() {
    const [funcionariosResp, lojasResp] = await Promise.all([
      apiFetch<Funcionario[]>("funcionarios"),
      apiFetch<Loja[]>("lojas"),
    ]);
    setFuncionarios(funcionariosResp);
    setLojas(lojasResp);
  }

  useEffect(() => {
    carregar();
  }, []);

  async function criar(event: React.FormEvent) {
    event.preventDefault();
    setErro(null);
    try {
      await apiFetch("funcionarios", {
        method: "POST",
        body: JSON.stringify({
          name,
          email,
          password,
          role,
          loja_id: role === "vendedor" ? Number(lojaId) : null,
        }),
      });
      setName("");
      setEmail("");
      setPassword("");
      await carregar();
    } catch {
      setErro("Não foi possível criar o funcionário. Verifique os dados (e-mail único, loja obrigatória para vendedor).");
    }
  }

  return (
    <div className="max-w-3xl text-slate-900">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
        <UsersRound className="h-5 w-5 text-blue-600" />
        Funcionários
      </h2>

      <form onSubmit={criar} className="mb-6 flex flex-wrap gap-2">
        <input placeholder="Nome" value={name} onChange={(e) => setName(e.target.value)} required className="flex-1 rounded border border-slate-300 bg-slate-50 px-3 py-2" />
        <input placeholder="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="flex-1 rounded border border-slate-300 bg-slate-50 px-3 py-2" />
        <input placeholder="Senha" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-40 rounded border border-slate-300 bg-slate-50 px-3 py-2" />
        <select value={role} onChange={(e) => setRole(e.target.value as "admin" | "vendedor")} className="rounded border border-slate-300 bg-slate-50 px-3 py-2">
          <option value="vendedor">Vendedor</option>
          <option value="admin">Admin</option>
        </select>
        {role === "vendedor" && (
          <select value={lojaId} onChange={(e) => setLojaId(e.target.value)} required className="rounded border border-slate-300 bg-slate-50 px-3 py-2">
            <option value="">Loja...</option>
            {lojas.map((loja) => (
              <option key={loja.id} value={loja.id}>{loja.nome}</option>
            ))}
          </select>
        )}
        <button className="flex items-center gap-1.5 rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-500">
          <Plus className="h-4 w-4" />
          Adicionar
        </button>
      </form>

      {erro && (
        <p className="mb-4 flex items-center gap-1.5 text-sm text-red-600">
          <AlertCircle className="h-4 w-4" />
          {erro}
        </p>
      )}

      <ul className="divide-y divide-slate-200 rounded border border-slate-200">
        {funcionarios.map((funcionario) => (
          <li key={funcionario.id} className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              {funcionario.role === "admin" ? (
                <ShieldCheck className="h-5 w-5 text-blue-600" />
              ) : (
                <UserRound className="h-5 w-5 text-slate-400" />
              )}
              <div>
                <p className="font-medium">{funcionario.name}</p>
                <p className="text-sm text-slate-500">{funcionario.email}</p>
              </div>
            </div>
            <span className="text-sm text-slate-500">
              {funcionario.role === "admin" ? "Admin" : `Vendedor — ${lojas.find((l) => l.id === funcionario.loja_id)?.nome ?? "?"}`}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
