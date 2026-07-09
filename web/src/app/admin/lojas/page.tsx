"use client";

import { AlertCircle, MapPin, Plus, Store } from "lucide-react";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/apiClient";
import type { Loja } from "@/lib/types";

export default function LojasPage() {
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [nome, setNome] = useState("");
  const [endereco, setEndereco] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  async function carregar() {
    setLojas(await apiFetch<Loja[]>("lojas"));
  }

  useEffect(() => {
    carregar();
  }, []);

  async function criar(event: React.FormEvent) {
    event.preventDefault();
    setErro(null);
    try {
      await apiFetch("lojas", { method: "POST", body: JSON.stringify({ nome, endereco }) });
      setNome("");
      setEndereco("");
      await carregar();
    } catch {
      setErro("Não foi possível criar a loja.");
    }
  }

  return (
    <div className="max-w-2xl text-slate-900">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
        <Store className="h-5 w-5 text-blue-600" />
        Lojas
      </h2>

      <form onSubmit={criar} className="mb-6 flex gap-2">
        <input
          placeholder="Nome da loja"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          required
          className="flex-1 rounded border border-slate-300 bg-slate-50 px-3 py-2"
        />
        <input
          placeholder="Endereço"
          value={endereco}
          onChange={(e) => setEndereco(e.target.value)}
          className="flex-1 rounded border border-slate-300 bg-slate-50 px-3 py-2"
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
        {lojas.map((loja) => (
          <li key={loja.id} className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <Store className="h-5 w-5 text-slate-400" />
              <div>
                <p className="font-medium">{loja.nome}</p>
                <p className="flex items-center gap-1 text-sm text-slate-500">
                  <MapPin className="h-3.5 w-3.5" />
                  {loja.endereco ?? "Sem endereço cadastrado"}
                </p>
              </div>
            </div>
            <span className={`text-sm ${loja.ativo ? "text-emerald-600" : "text-slate-500"}`}>
              {loja.ativo ? "Ativa" : "Inativa"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
