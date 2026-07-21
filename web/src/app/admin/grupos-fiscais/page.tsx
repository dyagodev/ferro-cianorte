"use client";

import { AlertCircle, Pencil, Plus, Receipt, Search, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/apiClient";
import { ModalCadastro } from "@/components/ModalCadastro";
import type { GrupoFiscal } from "@/lib/types";

const FORM_VAZIO = {
  nome: "",
  ncm: "",
  cfop_dentro_estado: "",
  cfop_fora_estado: "",
  csosn: "",
  cst_icms: "",
  percentual_reducao_bc: "",
  aliquota_icms: "",
  cst_pis: "",
  aliquota_pis: "",
  cst_cofins: "",
  aliquota_cofins: "",
  cst_ibscbs: "",
  cclasstrib_ibscbs: "",
};

export default function GruposFiscaisPage() {
  const [grupos, setGrupos] = useState<GrupoFiscal[]>([]);
  const [busca, setBusca] = useState("");
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<GrupoFiscal | null>(null);
  const [form, setForm] = useState(FORM_VAZIO);
  const [erro, setErro] = useState<string | null>(null);

  async function carregar(buscaAlvo = busca) {
    const query = buscaAlvo.trim() ? `?q=${encodeURIComponent(buscaAlvo.trim())}` : "";
    setGrupos(await apiFetch<GrupoFiscal[]>(`grupos-fiscais${query}`));
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

  function abrirCriacao() {
    setEditando(null);
    setForm(FORM_VAZIO);
    setErro(null);
    setModalAberto(true);
  }

  function abrirEdicao(grupo: GrupoFiscal) {
    setEditando(grupo);
    setForm({
      nome: grupo.nome,
      ncm: grupo.ncm ?? "",
      cfop_dentro_estado: grupo.cfop_dentro_estado ?? "",
      cfop_fora_estado: grupo.cfop_fora_estado ?? "",
      csosn: grupo.csosn ?? "",
      cst_icms: grupo.cst_icms ?? "",
      percentual_reducao_bc: grupo.percentual_reducao_bc ?? "",
      aliquota_icms: grupo.aliquota_icms ?? "",
      cst_pis: grupo.cst_pis ?? "",
      aliquota_pis: grupo.aliquota_pis ?? "",
      cst_cofins: grupo.cst_cofins ?? "",
      aliquota_cofins: grupo.aliquota_cofins ?? "",
      cst_ibscbs: grupo.cst_ibscbs ?? "",
      cclasstrib_ibscbs: grupo.cclasstrib_ibscbs ?? "",
    });
    setErro(null);
    setModalAberto(true);
  }

  async function salvar(event: React.FormEvent) {
    event.preventDefault();
    setErro(null);

    const payload = {
      nome: form.nome,
      ncm: form.ncm || null,
      cfop_dentro_estado: form.cfop_dentro_estado || null,
      cfop_fora_estado: form.cfop_fora_estado || null,
      csosn: form.csosn || null,
      cst_icms: form.cst_icms || null,
      percentual_reducao_bc: form.percentual_reducao_bc === "" ? null : Number(form.percentual_reducao_bc),
      aliquota_icms: form.aliquota_icms === "" ? null : Number(form.aliquota_icms),
      cst_pis: form.cst_pis || null,
      aliquota_pis: form.aliquota_pis === "" ? null : Number(form.aliquota_pis),
      cst_cofins: form.cst_cofins || null,
      aliquota_cofins: form.aliquota_cofins === "" ? null : Number(form.aliquota_cofins),
      cst_ibscbs: form.cst_ibscbs || null,
      cclasstrib_ibscbs: form.cclasstrib_ibscbs || null,
    };

    try {
      if (editando) {
        await apiFetch(`grupos-fiscais/${editando.id}`, { method: "PUT", body: JSON.stringify(payload) });
      } else {
        await apiFetch("grupos-fiscais", { method: "POST", body: JSON.stringify(payload) });
      }
      setModalAberto(false);
      await carregar();
    } catch {
      setErro("Não foi possível salvar o grupo fiscal.");
    }
  }

  async function excluir(grupo: GrupoFiscal) {
    if (!window.confirm(`Excluir o grupo fiscal "${grupo.nome}"?`)) return;
    try {
      await apiFetch(`grupos-fiscais/${grupo.id}`, { method: "DELETE" });
      await carregar();
    } catch {
      window.alert("Não foi possível excluir — provavelmente ainda tem produto vinculado a esse grupo.");
    }
  }

  function campo(chave: keyof typeof form, valor: string) {
    setForm((atual) => ({ ...atual, [chave]: valor }));
  }

  return (
    <div className="max-w-3xl text-slate-900">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Receipt className="h-5 w-5 text-blue-600" />
          Grupos Fiscais
        </h2>
        <button
          onClick={abrirCriacao}
          className="flex items-center gap-1.5 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
        >
          <Plus className="h-4 w-4" />
          Cadastrar
        </button>
      </div>

      <p className="mb-4 text-sm text-slate-500">
        Classificação fiscal reutilizável (NCM, CFOP, tributação) pra aplicar em vários produtos de uma vez, em vez de
        configurar campo por campo em cada um.
      </p>

      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome..."
          className="w-full rounded border border-slate-300 bg-white py-2 pl-9 pr-3 text-slate-900 outline-none focus:border-blue-500"
        />
      </div>

      <div className="overflow-auto rounded border border-slate-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr className="divide-x divide-slate-200">
              <th className="px-3 py-2">Nome</th>
              <th className="px-3 py-2">NCM</th>
              <th className="px-3 py-2">CFOP (UF/fora)</th>
              <th className="px-3 py-2">ICMS</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {grupos.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-slate-500">
                  Nenhum grupo fiscal encontrado{busca ? ` para "${busca}"` : ""}.
                </td>
              </tr>
            )}
            {grupos.map((grupo) => (
              <tr key={grupo.id} className="divide-x divide-slate-200 border-t border-slate-200">
                <td className="px-3 py-2 font-medium">{grupo.nome}</td>
                <td className="px-3 py-2 text-slate-500">{grupo.ncm ?? "—"}</td>
                <td className="px-3 py-2 text-slate-500">
                  {grupo.cfop_dentro_estado ?? "—"} / {grupo.cfop_fora_estado ?? "—"}
                </td>
                <td className="px-3 py-2 text-slate-500">
                  {grupo.csosn ? `CSOSN ${grupo.csosn}` : grupo.cst_icms ? `CST ${grupo.cst_icms}` : "—"}
                  {grupo.aliquota_icms ? ` (${grupo.aliquota_icms}%)` : ""}
                  {grupo.percentual_reducao_bc ? ` — red. BC ${grupo.percentual_reducao_bc}%` : ""}
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <button
                    onClick={() => abrirEdicao(grupo)}
                    className="mr-2 inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Editar
                  </button>
                  <button
                    onClick={() => excluir(grupo)}
                    className="inline-flex items-center gap-1 rounded border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Excluir
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalAberto && (
        <ModalCadastro
          titulo={editando ? "Editar Grupo Fiscal" : "Novo Grupo Fiscal"}
          icone={Receipt}
          onFechar={() => setModalAberto(false)}
        >
          <form onSubmit={salvar}>
            <label className="mb-1 block text-sm text-slate-500">Nome</label>
            <input
              autoFocus
              value={form.nome}
              onChange={(e) => campo("nome", e.target.value)}
              required
              placeholder="Ex.: Material de Construção — Revenda"
              className="mb-3 w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
            />

            <label className="mb-1 block text-sm text-slate-500">NCM</label>
            <input
              value={form.ncm}
              onChange={(e) => campo("ncm", e.target.value)}
              maxLength={8}
              placeholder="00000000"
              className="mb-3 w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
            />

            <div className="mb-3 grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm text-slate-500">CFOP dentro do estado</label>
                <input
                  value={form.cfop_dentro_estado}
                  onChange={(e) => campo("cfop_dentro_estado", e.target.value)}
                  maxLength={4}
                  placeholder="5102"
                  className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-500">CFOP fora do estado</label>
                <input
                  value={form.cfop_fora_estado}
                  onChange={(e) => campo("cfop_fora_estado", e.target.value)}
                  maxLength={4}
                  placeholder="6102"
                  className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <p className="mb-1 text-sm font-medium text-slate-600">ICMS</p>
            <div className="mb-3 grid grid-cols-4 gap-3">
              <div>
                <label className="mb-1 block text-xs text-slate-500">CSOSN (Simples)</label>
                <input
                  value={form.csosn}
                  onChange={(e) => campo("csosn", e.target.value)}
                  maxLength={3}
                  placeholder="102"
                  className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500">CST (Presumido/Real)</label>
                <input
                  value={form.cst_icms}
                  onChange={(e) => campo("cst_icms", e.target.value)}
                  maxLength={2}
                  placeholder="00"
                  className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500">Redução BC % (só CST 20/70/90)</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.percentual_reducao_bc}
                  onChange={(e) => campo("percentual_reducao_bc", e.target.value)}
                  placeholder="0"
                  className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500">Alíquota %</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.aliquota_icms}
                  onChange={(e) => campo("aliquota_icms", e.target.value)}
                  placeholder="18"
                  className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <p className="mb-1 text-sm font-medium text-slate-600">PIS / COFINS</p>
            <div className="mb-4 grid grid-cols-4 gap-3">
              <div>
                <label className="mb-1 block text-xs text-slate-500">CST PIS</label>
                <input
                  value={form.cst_pis}
                  onChange={(e) => campo("cst_pis", e.target.value)}
                  maxLength={2}
                  placeholder="07"
                  className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500">Alíquota %</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.aliquota_pis}
                  onChange={(e) => campo("aliquota_pis", e.target.value)}
                  className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500">CST COFINS</label>
                <input
                  value={form.cst_cofins}
                  onChange={(e) => campo("cst_cofins", e.target.value)}
                  maxLength={2}
                  placeholder="07"
                  className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500">Alíquota %</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.aliquota_cofins}
                  onChange={(e) => campo("aliquota_cofins", e.target.value)}
                  className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <p className="mb-1 text-sm font-medium text-slate-600">IBS / CBS (Reforma Tributária)</p>
            <p className="mb-2 text-xs text-slate-400">
              Usado em NFC-e e NF-e de lojas com Regime Normal — Simples Nacional não precisa preencher ainda (entra em
              vigor só em jan/2027). Deixe em branco pra usar o padrão (000 / 000001 — tributação integral, o caso
              mais comum).
            </p>
            <div className="mb-4 grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-slate-500">CST IBS/CBS</label>
                <input
                  value={form.cst_ibscbs}
                  onChange={(e) => campo("cst_ibscbs", e.target.value)}
                  maxLength={3}
                  placeholder="000"
                  className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500">cClassTrib</label>
                <input
                  value={form.cclasstrib_ibscbs}
                  onChange={(e) => campo("cclasstrib_ibscbs", e.target.value)}
                  maxLength={6}
                  placeholder="000001"
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
