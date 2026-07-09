"use client";

import { AlertCircle, CircleUserRound, Plus, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/apiClient";
import type { Cliente } from "@/lib/types";

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [nome, setNome] = useState("");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  async function carregar() {
    setClientes(await apiFetch<Cliente[]>("clientes"));
  }

  useEffect(() => {
    carregar();
  }, []);

  async function criar(event: React.FormEvent) {
    event.preventDefault();
    setErro(null);
    try {
      await apiFetch("clientes", { method: "POST", body: JSON.stringify({ nome, cpf_cnpj: cpfCnpj || null }) });
      setNome("");
      setCpfCnpj("");
      await carregar();
    } catch {
      setErro("Não foi possível criar o cliente.");
    }
  }

  return (
    <div className="max-w-2xl text-slate-900">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
        <Users className="h-5 w-5 text-blue-600" />
        Clientes
      </h2>

      <form onSubmit={criar} className="mb-6 flex gap-2">
        <input
          placeholder="Nome"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          required
          className="flex-1 rounded border border-slate-300 bg-slate-50 px-3 py-2"
        />
        <input
          placeholder="CPF/CNPJ"
          value={cpfCnpj}
          onChange={(e) => setCpfCnpj(e.target.value)}
          className="w-48 rounded border border-slate-300 bg-slate-50 px-3 py-2"
        />
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
        {clientes.map((cliente) => (
          <li key={cliente.id} className="flex items-center justify-between px-4 py-3">
            <span className="flex items-center gap-2">
              <CircleUserRound className="h-5 w-5 text-slate-400" />
              {cliente.nome}
            </span>
            <span className="text-sm text-slate-500">{cliente.cpf_cnpj ?? "—"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
