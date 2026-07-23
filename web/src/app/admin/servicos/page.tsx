"use client";

import { AlertCircle, Pencil, Plus, Search, Wrench } from "lucide-react";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/apiClient";
import { ModalCadastro } from "@/components/ModalCadastro";
import type { Servico } from "@/lib/types";

const FORM_VAZIO = {
  descricao: "",
  codigoServicoMunicipal: "",
  aliquotaIss: "",
  precoVenda: "",
};

export default function ServicosPage() {
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [busca, setBusca] = useState("");
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<Servico | null>(null);
  const [form, setForm] = useState(FORM_VAZIO);
  const [erro, setErro] = useState<string | null>(null);

  async function carregar(buscaAlvo = busca) {
    const query = buscaAlvo.trim() ? `?q=${encodeURIComponent(buscaAlvo.trim())}` : "";
    setServicos(await apiFetch<Servico[]>(`servicos${query}`));
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

  function campo(chave: keyof typeof form, valor: string) {
    setForm((atual) => ({ ...atual, [chave]: valor }));
  }

  function abrirCriacao() {
    setEditando(null);
    setForm(FORM_VAZIO);
    setErro(null);
    setModalAberto(true);
  }

  function abrirEdicao(servico: Servico) {
    setEditando(servico);
    setForm({
      descricao: servico.descricao,
      codigoServicoMunicipal: servico.codigo_servico_municipal ?? "",
      aliquotaIss: servico.aliquota_iss ?? "",
      precoVenda: servico.preco_venda,
    });
    setErro(null);
    setModalAberto(true);
  }

  async function salvar(event: React.FormEvent) {
    event.preventDefault();
    setErro(null);

    const payload = {
      descricao: form.descricao,
      codigo_servico_municipal: form.codigoServicoMunicipal || null,
      aliquota_iss: form.aliquotaIss !== "" ? Number(form.aliquotaIss) : null,
      preco_venda: form.precoVenda !== "" ? Number(form.precoVenda) : 0,
    };

    try {
      if (editando) {
        await apiFetch(`servicos/${editando.id}`, { method: "PUT", body: JSON.stringify(payload) });
      } else {
        await apiFetch("servicos", { method: "POST", body: JSON.stringify(payload) });
      }
      setModalAberto(false);
      await carregar();
    } catch {
      setErro("Não foi possível salvar.");
    }
  }

  return (
    <div className="max-w-2xl text-slate-900">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Wrench className="h-5 w-5 text-blue-600" />
          Serviços
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
          placeholder="Buscar por descrição..."
          className="w-full rounded border border-slate-300 bg-white py-2 pl-9 pr-3 text-slate-900 outline-none focus:border-blue-500"
        />
      </div>

      <ul className="divide-y divide-slate-200 rounded border border-slate-200">
        {servicos.length === 0 && (
          <li className="px-4 py-8 text-center text-slate-500">
            Nenhum serviço encontrado{busca ? ` para "${busca}"` : ""}.
          </li>
        )}
        {servicos.map((servico) => (
          <li key={servico.id} className="flex items-center justify-between px-4 py-3">
            <span className="flex items-center gap-2">
              <Wrench className="h-4 w-4 text-slate-400" />
              {servico.descricao}
            </span>
            <span className="flex items-center gap-3 text-sm text-slate-500">
              R$ {Number(servico.preco_venda).toFixed(2)}
              <button onClick={() => abrirEdicao(servico)} className="text-slate-400 hover:text-blue-600">
                <Pencil className="h-4 w-4" />
              </button>
            </span>
          </li>
        ))}
      </ul>

      {modalAberto && (
        <ModalCadastro
          titulo={editando ? "Editar Serviço" : "Novo Serviço"}
          icone={Wrench}
          onFechar={() => setModalAberto(false)}
        >
          <form onSubmit={salvar}>
            <label className="mb-1 block text-sm text-slate-500">Descrição</label>
            <input
              autoFocus
              value={form.descricao}
              onChange={(e) => campo("descricao", e.target.value)}
              required
              className="mb-3 w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
            />

            <label className="mb-1 block text-sm text-slate-500">Preço R$</label>
            <input
              type="number"
              step="0.01"
              value={form.precoVenda}
              onChange={(e) => campo("precoVenda", e.target.value)}
              className="mb-3 w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
            />

            <div className="mb-4 grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm text-slate-500">Cód. serviço municipal (LC 116)</label>
                <input
                  value={form.codigoServicoMunicipal}
                  onChange={(e) => campo("codigoServicoMunicipal", e.target.value)}
                  className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-500">Alíquota ISS %</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.aliquotaIss}
                  onChange={(e) => campo("aliquotaIss", e.target.value)}
                  className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                />
              </div>
            </div>

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
