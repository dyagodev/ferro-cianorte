"use client";

import { AlertCircle, Plus, Search, Truck } from "lucide-react";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/apiClient";

type Fornecedor = { id: number; nome: string; cnpj: string | null; contato: string | null };

export default function FornecedoresPage() {
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [busca, setBusca] = useState("");
  const [nome, setNome] = useState("");
  const [contato, setContato] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  async function carregar(buscaAlvo = busca) {
    const query = buscaAlvo.trim() ? `?q=${encodeURIComponent(buscaAlvo.trim())}` : "";
    setFornecedores(await apiFetch<Fornecedor[]>(`fornecedores${query}`));
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => carregar(busca), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca]);

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

      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome ou CNPJ..."
          className="w-full rounded border border-slate-300 bg-white py-2 pl-9 pr-3 text-slate-900 outline-none focus:border-blue-500"
        />
      </div>

      <ul className="divide-y divide-slate-200 rounded border border-slate-200">
        {fornecedores.length === 0 && (
          <li className="px-4 py-8 text-center text-slate-500">
            Nenhum fornecedor encontrado{busca ? ` para "${busca}"` : ""}.
          </li>
        )}
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
