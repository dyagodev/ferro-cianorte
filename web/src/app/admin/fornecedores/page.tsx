"use client";

import { AlertCircle, Plus, Truck } from "lucide-react";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/apiClient";

type Fornecedor = { id: number; nome: string; cnpj: string | null; contato: string | null };

export default function FornecedoresPage() {
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [nome, setNome] = useState("");
  const [contato, setContato] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  async function carregar() {
    setFornecedores(await apiFetch<Fornecedor[]>("fornecedores"));
  }

  useEffect(() => {
    carregar();
  }, []);

  async function criar(event: React.FormEvent) {
    event.preventDefault();
    setErro(null);
    try {
      await apiFetch("fornecedores", { method: "POST", body: JSON.stringify({ nome, contato: contato || null }) });
      setNome("");
      setContato("");
      await carregar();
    } catch {
      setErro("Não foi possível criar o fornecedor.");
    }
  }

  return (
    <div className="max-w-2xl text-slate-900">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
        <Truck className="h-5 w-5 text-blue-600" />
        Fornecedores
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
          placeholder="Contato"
          value={contato}
          onChange={(e) => setContato(e.target.value)}
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
        {fornecedores.map((fornecedor) => (
          <li key={fornecedor.id} className="flex items-center justify-between px-4 py-3">
            <span className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-slate-400" />
              {fornecedor.nome}
            </span>
            <span className="text-sm text-slate-500">{fornecedor.contato ?? "—"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
