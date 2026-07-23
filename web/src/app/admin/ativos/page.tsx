"use client";

import { AlertCircle, Pencil, Plus, Search, Tag } from "lucide-react";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/apiClient";
import { ModalCadastro } from "@/components/ModalCadastro";
import type { Ativo, Cliente } from "@/lib/types";

const FORM_VAZIO = {
  cliente_id: "",
  tipo: "",
  nome: "",
  identificador: "",
  observacoes: "",
};

export default function AtivosPage() {
  const [ativos, setAtivos] = useState<Ativo[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [busca, setBusca] = useState("");
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<Ativo | null>(null);
  const [form, setForm] = useState(FORM_VAZIO);
  const [erro, setErro] = useState<string | null>(null);

  async function carregar(buscaAlvo = busca) {
    const query = buscaAlvo.trim() ? `?q=${encodeURIComponent(buscaAlvo.trim())}` : "";
    setAtivos(await apiFetch<Ativo[]>(`ativos${query}`));
  }

  useEffect(() => {
    carregar();
    apiFetch<Cliente[]>("clientes").then(setClientes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => carregar(busca), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca]);

  function campo(chave: keyof typeof form, valor: string) {
    setForm((atual) => ({ ...atual, [chave]: valor }));
  }

  function abrirCriacao() {
    setEditando(null);
    setForm(FORM_VAZIO);
    setErro(null);
    setModalAberto(true);
  }

  function abrirEdicao(ativo: Ativo) {
    setEditando(ativo);
    setForm({
      cliente_id: String(ativo.cliente_id),
      tipo: ativo.tipo ?? "",
      nome: ativo.nome,
      identificador: ativo.identificador ?? "",
      observacoes: ativo.observacoes ?? "",
    });
    setErro(null);
    setModalAberto(true);
  }

  async function salvar(event: React.FormEvent) {
    event.preventDefault();
    setErro(null);

    const payload = {
      cliente_id: Number(form.cliente_id),
      tipo: form.tipo || null,
      nome: form.nome,
      identificador: form.identificador || null,
      observacoes: form.observacoes || null,
    };

    try {
      if (editando) {
        await apiFetch(`ativos/${editando.id}`, { method: "PUT", body: JSON.stringify(payload) });
      } else {
        await apiFetch("ativos", { method: "POST", body: JSON.stringify(payload) });
      }
      setModalAberto(false);
      await carregar();
    } catch {
      setErro("Não foi possível salvar.");
    }
  }

  return (
    <div className="max-w-3xl text-slate-900">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Tag className="h-5 w-5 text-blue-600" />
          Itens do Cliente
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
          placeholder="Buscar por nome ou identificador..."
          className="w-full rounded border border-slate-300 bg-white py-2 pl-9 pr-3 text-slate-900 outline-none focus:border-blue-500"
        />
      </div>

      <ul className="divide-y divide-slate-200 rounded border border-slate-200">
        {ativos.length === 0 && (
          <li className="px-4 py-8 text-center text-slate-500">Nenhum item encontrado{busca ? ` para "${busca}"` : ""}.</li>
        )}
        {ativos.map((ativo) => (
          <li key={ativo.id} className="flex items-center justify-between px-4 py-3">
            <span className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-slate-400" />
              <span>
                {ativo.nome}
                {ativo.tipo && <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">{ativo.tipo}</span>}
              </span>
            </span>
            <span className="flex items-center gap-3 text-sm text-slate-500">
              {ativo.cliente?.nome ?? "—"}
              <button onClick={() => abrirEdicao(ativo)} className="text-slate-400 hover:text-blue-600">
                <Pencil className="h-4 w-4" />
              </button>
            </span>
          </li>
        ))}
      </ul>

      {modalAberto && (
        <ModalCadastro
          titulo={editando ? "Editar Item do Cliente" : "Novo Item do Cliente"}
          icone={Tag}
          onFechar={() => setModalAberto(false)}
        >
          <form onSubmit={salvar}>
            <label className="mb-1 block text-sm text-slate-500">Cliente</label>
            <select
              value={form.cliente_id}
              onChange={(e) => campo("cliente_id", e.target.value)}
              required
              className="mb-3 w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
            >
              <option value="">Selecione...</option>
              {clientes.map((cliente) => (
                <option key={cliente.id} value={cliente.id}>
                  {cliente.nome}
                </option>
              ))}
            </select>

            <div className="mb-3 grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm text-slate-500">Tipo</label>
                <input
                  value={form.tipo}
                  onChange={(e) => campo("tipo", e.target.value)}
                  placeholder="pet, veículo..."
                  className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-500">Identificador (opcional)</label>
                <input
                  value={form.identificador}
                  onChange={(e) => campo("identificador", e.target.value)}
                  placeholder="microchip, placa..."
                  className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <label className="mb-1 block text-sm text-slate-500">Nome</label>
            <input
              autoFocus
              value={form.nome}
              onChange={(e) => campo("nome", e.target.value)}
              required
              className="mb-3 w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
            />

            <label className="mb-1 block text-sm text-slate-500">Observações (opcional)</label>
            <textarea
              value={form.observacoes}
              onChange={(e) => campo("observacoes", e.target.value)}
              rows={2}
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
