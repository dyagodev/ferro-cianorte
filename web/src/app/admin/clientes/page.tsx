"use client";

import { AlertCircle, CircleUserRound, Plus, Search, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/apiClient";
import { ModalCadastro } from "@/components/ModalCadastro";
import type { Cliente } from "@/lib/types";

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [busca, setBusca] = useState("");
  const [modalAberto, setModalAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  async function carregar(buscaAlvo = busca) {
    const query = buscaAlvo.trim() ? `?q=${encodeURIComponent(buscaAlvo.trim())}` : "";
    setClientes(await apiFetch<Cliente[]>(`clientes${query}`));
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
      await apiFetch("clientes", { method: "POST", body: JSON.stringify({ nome, cpf_cnpj: cpfCnpj || null }) });
      setNome("");
      setCpfCnpj("");
      setModalAberto(false);
      await carregar();
    } catch {
      setErro("Não foi possível criar o cliente.");
    }
  }

  return (
    <div className="max-w-2xl text-slate-900">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Users className="h-5 w-5 text-blue-600" />
          Clientes
        </h2>
        <button
          onClick={() => {
            setErro(null);
            setModalAberto(true);
          }}
          className="flex items-center gap-1.5 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
        >
          <Plus className="h-4 w-4" />
          Cadastrar
        </button>
      </div>

      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome ou CPF/CNPJ..."
          className="w-full rounded border border-slate-300 bg-white py-2 pl-9 pr-3 text-slate-900 outline-none focus:border-blue-500"
        />
      </div>

      <ul className="divide-y divide-slate-200 rounded border border-slate-200">
        {clientes.length === 0 && (
          <li className="px-4 py-8 text-center text-slate-500">
            Nenhum cliente encontrado{busca ? ` para "${busca}"` : ""}.
          </li>
        )}
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

      {modalAberto && (
        <ModalCadastro titulo="Novo Cliente" icone={Users} onFechar={() => setModalAberto(false)}>
          <form onSubmit={criar}>
            <label className="mb-1 block text-sm text-slate-500">Nome</label>
            <input
              autoFocus
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
              className="mb-3 w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
            />

            <label className="mb-1 block text-sm text-slate-500">CPF/CNPJ (opcional)</label>
            <input
              value={cpfCnpj}
              onChange={(e) => setCpfCnpj(e.target.value)}
              className="mb-4 w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
            />

            {erro && (
              <p className="mb-4 flex items-center gap-1.5 text-sm text-red-600">
                <AlertCircle className="h-4 w-4" />
                {erro}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalAberto(false)}
                className="rounded border border-slate-300 px-4 py-2 text-slate-600 hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="flex items-center gap-2 rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-500"
              >
                <Plus className="h-4 w-4" />
                Cadastrar
              </button>
            </div>
          </form>
        </ModalCadastro>
      )}
    </div>
  );
}
