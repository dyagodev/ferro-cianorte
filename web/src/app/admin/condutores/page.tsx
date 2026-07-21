"use client";

import { AlertCircle, IdCard, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/apiClient";
import { ModalCadastro } from "@/components/ModalCadastro";
import type { Condutor } from "@/lib/types";

const FORM_VAZIO = { nome: "", cpf: "" };

export default function CondutoresPage() {
  const [condutores, setCondutores] = useState<Condutor[]>([]);
  const [busca, setBusca] = useState("");
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<Condutor | null>(null);
  const [form, setForm] = useState(FORM_VAZIO);
  const [erro, setErro] = useState<string | null>(null);

  async function carregar() {
    setCondutores(await apiFetch<Condutor[]>("condutores"));
  }

  useEffect(() => {
    carregar();
  }, []);

  const filtrados = condutores.filter((c) => c.nome.toLowerCase().includes(busca.trim().toLowerCase()));

  function campo(chave: keyof typeof form, valor: string) {
    setForm((atual) => ({ ...atual, [chave]: valor }));
  }

  function abrirCriacao() {
    setEditando(null);
    setForm(FORM_VAZIO);
    setErro(null);
    setModalAberto(true);
  }

  function abrirEdicao(condutor: Condutor) {
    setEditando(condutor);
    setForm({ nome: condutor.nome, cpf: condutor.cpf });
    setErro(null);
    setModalAberto(true);
  }

  async function salvar(event: React.FormEvent) {
    event.preventDefault();
    setErro(null);

    try {
      if (editando) {
        await apiFetch(`condutores/${editando.id}`, { method: "PUT", body: JSON.stringify(form) });
      } else {
        await apiFetch("condutores", { method: "POST", body: JSON.stringify(form) });
      }
      setModalAberto(false);
      await carregar();
    } catch {
      setErro("Não foi possível salvar o condutor.");
    }
  }

  async function desativar(condutor: Condutor) {
    if (!window.confirm(`Desativar o condutor "${condutor.nome}"?`)) return;
    try {
      await apiFetch(`condutores/${condutor.id}`, { method: "DELETE" });
      await carregar();
    } catch {
      setErro("Não foi possível desativar o condutor.");
    }
  }

  return (
    <div className="max-w-2xl text-slate-900">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <IdCard className="h-5 w-5 text-blue-600" />
          Condutores
        </h2>
        <button
          onClick={abrirCriacao}
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
          placeholder="Buscar por nome..."
          className="w-full rounded border border-slate-300 bg-white py-2 pl-9 pr-3 text-slate-900 outline-none focus:border-blue-500"
        />
      </div>

      <ul className="divide-y divide-slate-200 rounded border border-slate-200">
        {filtrados.length === 0 && (
          <li className="px-4 py-8 text-center text-slate-500">
            Nenhum condutor encontrado{busca ? ` para "${busca}"` : ""}.
          </li>
        )}
        {filtrados.map((condutor) => (
          <li key={condutor.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="font-medium">{condutor.nome}</p>
              <p className="text-sm text-slate-500">{condutor.cpf}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => abrirEdicao(condutor)}
                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                title="Editar"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                onClick={() => desativar(condutor)}
                className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                title="Desativar"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </li>
        ))}
      </ul>

      {modalAberto && (
        <ModalCadastro
          titulo={editando ? "Editar Condutor" : "Novo Condutor"}
          icone={IdCard}
          onFechar={() => setModalAberto(false)}
        >
          <form onSubmit={salvar}>
            <label className="mb-1 block text-sm text-slate-500">Nome</label>
            <input
              autoFocus
              value={form.nome}
              onChange={(e) => campo("nome", e.target.value)}
              required
              className="mb-3 w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
            />

            <label className="mb-1 block text-sm text-slate-500">CPF</label>
            <input
              value={form.cpf}
              onChange={(e) => campo("cpf", e.target.value)}
              required
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
                {editando ? "Salvar" : "Cadastrar"}
              </button>
            </div>
          </form>
        </ModalCadastro>
      )}
    </div>
  );
}
