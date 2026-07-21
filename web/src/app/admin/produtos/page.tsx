"use client";

import {
  AlertCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Package,
  Pencil,
  Plus,
  Power,
  PowerOff,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/apiClient";
import { CampoDinheiro } from "@/components/CampoDinheiro";
import { ModalCadastro } from "@/components/ModalCadastro";
import type { GrupoFiscal, Loja, NaturezaProduto, Produto } from "@/lib/types";

type EdicaoEstoque = { produtoId: number; lojaId: number };

type PaginaProdutos = {
  data: Produto[];
  current_page: number;
  last_page: number;
  total: number;
};

const POR_PAGINA = 30;

type ColunaOpcional = "cod" | "natureza" | "grupoFiscal";

const COLUNAS_OPCIONAIS: { chave: ColunaOpcional; rotulo: string }[] = [
  { chave: "cod", rotulo: "Código" },
  { chave: "natureza", rotulo: "Natureza" },
  { chave: "grupoFiscal", rotulo: "Grupo Fiscal" },
];

const COLUNAS_STORAGE_KEY = "dm-nexus-colunas-produtos";

// Natureza e Grupo Fiscal ficam ocultos por padrão — só quem usa emissão
// fiscal precisa ver essas colunas no dia a dia, o resto só polui a tabela.
function colunasPadrao(): Record<ColunaOpcional, boolean> {
  return { cod: true, natureza: false, grupoFiscal: false };
}

const FORM_VAZIO = {
  descricao: "",
  codigoInterno: "",
  marca: "",
  unidade: "UN",
  precoCusto: 0,
  margemPercentual: "",
  precoVenda: 0,
  estoqueMinimo: "",
  grupoFiscalId: "",
  natureza: "produto" as NaturezaProduto,
  codigoServicoMunicipal: "",
  aliquotaIss: "",
};

export default function ProdutosPage() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [gruposFiscais, setGruposFiscais] = useState<GrupoFiscal[]>([]);
  const [pagina, setPagina] = useState(1);
  const [ultimaPagina, setUltimaPagina] = useState(1);
  const [total, setTotal] = useState(0);
  const [busca, setBusca] = useState("");
  const [modalAberto, setModalAberto] = useState(false);
  const [editandoId, setEditandoId] = useState<number | null>(null);

  const [form, setForm] = useState(FORM_VAZIO);

  const [colunas, setColunas] = useState<Record<ColunaOpcional, boolean>>(colunasPadrao);
  const [colunasAbertas, setColunasAbertas] = useState(false);
  const menuColunasRef = useRef<HTMLDivElement>(null);

  const [erro, setErro] = useState<string | null>(null);
  const [edicao, setEdicao] = useState<EdicaoEstoque | null>(null);
  const [valorEdicao, setValorEdicao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [alternandoAtivo, setAlternandoAtivo] = useState<EdicaoEstoque | null>(null);

  async function carregar(paginaAlvo = pagina, buscaAlvo = busca) {
    const query = new URLSearchParams({ page: String(paginaAlvo), per_page: String(POR_PAGINA) });
    if (buscaAlvo.trim()) query.set("q", buscaAlvo.trim());

    const [produtosResp, lojasResp, gruposFiscaisResp] = await Promise.all([
      apiFetch<PaginaProdutos>(`produtos?${query.toString()}`),
      apiFetch<Loja[]>("lojas"),
      apiFetch<GrupoFiscal[]>("grupos-fiscais"),
    ]);
    setProdutos(produtosResp.data);
    setPagina(produtosResp.current_page);
    setUltimaPagina(produtosResp.last_page);
    setTotal(produtosResp.total);
    setLojas(lojasResp);
    setGruposFiscais(gruposFiscaisResp);
  }

  useEffect(() => {
    carregar(1);

    const salvo = window.localStorage.getItem(COLUNAS_STORAGE_KEY);
    if (salvo) {
      try {
        setColunas({ ...colunasPadrao(), ...JSON.parse(salvo) });
      } catch {
        // ignora preferência corrompida, mantém o padrão
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Busca com debounce: sempre volta pra página 1 (um resultado filtrado não
  // faz sentido continuar na página 5 de antes).
  useEffect(() => {
    const timer = setTimeout(() => carregar(1, busca), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca]);

  useEffect(() => {
    function fecharAoClicarFora(event: MouseEvent) {
      if (menuColunasRef.current && !menuColunasRef.current.contains(event.target as Node)) {
        setColunasAbertas(false);
      }
    }
    document.addEventListener("mousedown", fecharAoClicarFora);
    return () => document.removeEventListener("mousedown", fecharAoClicarFora);
  }, []);

  function alternarColuna(chave: ColunaOpcional) {
    setColunas((atual) => {
      const novo = { ...atual, [chave]: !atual[chave] };
      window.localStorage.setItem(COLUNAS_STORAGE_KEY, JSON.stringify(novo));
      return novo;
    });
  }

  function campo<K extends keyof typeof form>(chave: K, valor: (typeof form)[K]) {
    setForm((atual) => ({ ...atual, [chave]: valor }));
  }

  function totalEstoque(produto: Produto): number {
    // A API devolve quantidade como texto (ex.: "8.333") — sem o Number(),
    // "soma + estoque.quantidade" vira concatenação de string em vez de soma.
    return produto.estoques?.reduce((soma, estoque) => soma + Number(estoque.quantidade), 0) ?? 0;
  }

  // Só mostra casas decimais quando o valor realmente tem fração — "10.000"
  // vira "10", mas "8.333" continua "8.333".
  function formatarQuantidade(valor: number): string {
    return Number.isFinite(valor) ? String(Math.round(valor * 1000) / 1000) : "0";
  }

  function abrirCriacao() {
    setEditandoId(null);
    setForm(FORM_VAZIO);
    setErro(null);
    setModalAberto(true);
  }

  function abrirEdicao(produto: Produto) {
    setEditandoId(produto.id);
    setForm({
      descricao: produto.descricao,
      codigoInterno: produto.codigo_interno ?? "",
      marca: "",
      unidade: produto.unidade ?? "UN",
      precoCusto: 0,
      margemPercentual: "",
      precoVenda: Number(produto.preco_venda) || 0,
      estoqueMinimo: "",
      grupoFiscalId: produto.grupo_fiscal_id ? String(produto.grupo_fiscal_id) : "",
      natureza: produto.natureza ?? "produto",
      codigoServicoMunicipal: produto.codigo_servico_municipal ?? "",
      aliquotaIss: produto.aliquota_iss ?? "",
    });
    setErro(null);
    setModalAberto(true);
  }

  async function salvar(event: React.FormEvent) {
    event.preventDefault();
    setErro(null);

    const payload = {
      descricao: form.descricao,
      codigo_interno: form.codigoInterno || null,
      marca: form.marca || null,
      unidade: form.unidade || "UN",
      preco_custo: form.precoCusto,
      margem_percentual: Number(form.margemPercentual) || 0,
      preco_venda: form.precoVenda,
      estoque_minimo: Number(form.estoqueMinimo) || 0,
      grupo_fiscal_id: form.grupoFiscalId ? Number(form.grupoFiscalId) : null,
      natureza: form.natureza,
      codigo_servico_municipal: form.natureza === "servico" ? form.codigoServicoMunicipal || null : null,
      aliquota_iss: form.natureza === "servico" && form.aliquotaIss !== "" ? Number(form.aliquotaIss) : null,
    };

    try {
      if (editandoId) {
        await apiFetch(`produtos/${editandoId}`, { method: "PUT", body: JSON.stringify(payload) });
      } else {
        await apiFetch("produtos", { method: "POST", body: JSON.stringify(payload) });
      }
      setModalAberto(false);
      await carregar();
    } catch {
      setErro(editandoId ? "Não foi possível salvar o produto." : "Não foi possível criar o produto.");
    }
  }

  function estoqueDoProduto(produto: Produto, lojaId: number): number {
    return Number(produto.estoques?.find((estoque) => estoque.loja_id === lojaId)?.quantidade ?? 0);
  }

  // Produto pode estar desligado numa loja específica (vem do sync do Link
  // Pro) mesmo sem estar desativado geral — sem registro de estoque ainda
  // não sincronizado, considera ativo (não é o mesmo que desligado).
  function estoqueAtivoNaLoja(produto: Produto, lojaId: number): boolean {
    return produto.estoques?.find((estoque) => estoque.loja_id === lojaId)?.ativo ?? true;
  }

  function iniciarEdicao(produto: Produto, lojaId: number) {
    setEdicao({ produtoId: produto.id, lojaId });
    setValorEdicao(String(estoqueDoProduto(produto, lojaId)));
  }

  async function salvarEdicao() {
    if (!edicao) return;
    setSalvando(true);
    try {
      await apiFetch(`produtos/${edicao.produtoId}/estoque`, {
        method: "POST",
        body: JSON.stringify({ loja_id: edicao.lojaId, quantidade: Number(valorEdicao) || 0 }),
      });
      setEdicao(null);
      await carregar();
    } catch {
      setErro("Não foi possível atualizar o estoque.");
    } finally {
      setSalvando(false);
    }
  }

  async function alternarAtivoNaLoja(produto: Produto, lojaId: number, ativo: boolean) {
    setAlternandoAtivo({ produtoId: produto.id, lojaId });
    try {
      await apiFetch(`produtos/${produto.id}/estoque/ativo`, {
        method: "POST",
        body: JSON.stringify({ loja_id: lojaId, ativo }),
      });
      await carregar();
    } catch {
      setErro("Não foi possível alterar o status do produto nessa loja.");
    } finally {
      setAlternandoAtivo(null);
    }
  }

  // "Excluir" aqui é sempre soft-delete (ativo = false) — o backend já
  // filtra produto inativo em qualquer listagem (admin e PDV), não some
  // do histórico de vendas já feitas.
  async function desativar(produto: Produto) {
    if (!window.confirm(`Desativar "${produto.descricao}"? Ele deixará de aparecer nas buscas e no PDV.`)) return;

    try {
      await apiFetch(`produtos/${produto.id}`, { method: "DELETE" });
      await carregar();
    } catch {
      setErro("Não foi possível desativar o produto.");
    }
  }

  // Ordena as colunas de loja por id (não por nome) — é o que dá Matriz,
  // Floriano, SJP na ordem certa em vez de alfabética.
  const lojasOrdenadas = [...lojas].sort((a, b) => a.id - b.id);

  const totalColunas =
    3 + Object.values(colunas).filter(Boolean).length + lojas.length; // Produto + Preço + Remover sempre visíveis

  return (
    <div className="text-slate-900">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Package className="h-5 w-5 text-blue-600" />
          Produtos
        </h2>
        <button
          onClick={abrirCriacao}
          className="flex items-center gap-1.5 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
        >
          <Plus className="h-4 w-4" />
          Cadastrar
        </button>
      </div>

      {erro && !modalAberto && (
        <p className="mb-4 flex items-center gap-1.5 text-sm text-red-600">
          <AlertCircle className="h-4 w-4" />
          {erro}
        </p>
      )}

      <div className="mb-3 flex items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por descrição ou código interno..."
            className="w-full rounded border border-slate-300 bg-white py-2 pl-9 pr-3 text-slate-900 outline-none focus:border-blue-500"
          />
        </div>

        <div className="relative" ref={menuColunasRef}>
          <button
            onClick={() => setColunasAbertas((atual) => !atual)}
            className="flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
          >
            <Columns3 className="h-4 w-4" />
            Colunas
          </button>
          {colunasAbertas && (
            <div className="absolute right-0 z-10 mt-1 w-48 rounded border border-slate-300 bg-white p-2 shadow-lg">
              {COLUNAS_OPCIONAIS.map((coluna) => (
                <label key={coluna.chave} className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-slate-100">
                  <input
                    type="checkbox"
                    checked={colunas[coluna.chave]}
                    onChange={() => alternarColuna(coluna.chave)}
                    className="h-4 w-4"
                  />
                  {coluna.rotulo}
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="overflow-auto rounded border border-slate-200">
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-sm text-slate-500">
            <tr className="divide-x divide-slate-200">
              <th className="px-3 py-2">Produto</th>
              {colunas.cod && <th className="px-3 py-2">Cod</th>}
              {colunas.natureza && <th className="px-3 py-2">Natureza</th>}
              {colunas.grupoFiscal && <th className="px-3 py-2">Grupo Fiscal</th>}
              <th className="px-3 py-2">Preço</th>
              {lojasOrdenadas.map((loja) => (
                <th key={loja.id} className="px-3 py-2">{loja.nome}</th>
              ))}
              <th className="px-3 py-2">Est Total</th>
              <th className="px-3 py-2">Ações</th>
            </tr>
          </thead>
          <tbody>
            {produtos.length === 0 && (
              <tr>
                <td colSpan={totalColunas} className="px-3 py-8 text-center text-slate-500">
                  Nenhum produto encontrado{busca ? ` para "${busca}"` : ""}.
                </td>
              </tr>
            )}
            {produtos.map((produto) => (
              <tr key={produto.id} className="divide-x divide-slate-200 border-t border-slate-200">
                <td className="px-3 py-2">{produto.descricao}</td>
                {colunas.cod && <td className="px-3 py-2 text-slate-500">{produto.codigo_interno ?? "—"}</td>}
                {colunas.natureza && (
                  <td className="px-3 py-2">
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                        produto.natureza === "servico" ? "bg-purple-100 text-purple-700" : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {produto.natureza === "servico" ? "Serviço" : "Produto"}
                    </span>
                  </td>
                )}
                {colunas.grupoFiscal && (
                  <td className="px-3 py-2 text-slate-500">{produto.grupo_fiscal?.nome ?? "—"}</td>
                )}
                <td className="px-3 py-2">R$ {Number(produto.preco_venda).toFixed(2)}</td>
                {lojasOrdenadas.map((loja) => {
                  const quantidade = estoqueDoProduto(produto, loja.id);
                  const ativoNaLoja = estoqueAtivoNaLoja(produto, loja.id);
                  const editandoEsta = edicao?.produtoId === produto.id && edicao.lojaId === loja.id;
                  const alternandoEsta =
                    alternandoAtivo?.produtoId === produto.id && alternandoAtivo.lojaId === loja.id;

                  return (
                    <td key={loja.id} className="px-3 py-2">
                      {editandoEsta ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            step="0.001"
                            autoFocus
                            value={valorEdicao}
                            onChange={(e) => setValorEdicao(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") salvarEdicao();
                              if (e.key === "Escape") setEdicao(null);
                            }}
                            className="w-20 rounded border border-blue-400 bg-white px-2 py-1"
                          />
                          <button
                            onClick={salvarEdicao}
                            disabled={salvando}
                            className="rounded bg-emerald-600 p-1.5 text-white hover:bg-emerald-500 disabled:opacity-60"
                            title="Salvar"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setEdicao(null)}
                            disabled={salvando}
                            className="rounded border border-slate-300 p-1.5 text-slate-600 hover:bg-slate-100"
                            title="Cancelar"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : !ativoNaLoja ? (
                        <div className="flex items-center gap-2">
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-500">
                            Desativado
                          </span>
                          <button
                            onClick={() => alternarAtivoNaLoja(produto, loja.id, true)}
                            disabled={alternandoEsta}
                            className="flex items-center gap-1 rounded border border-emerald-300 px-2 py-1 text-sm text-emerald-600 hover:bg-emerald-50 disabled:opacity-60"
                          >
                            <Power className="h-3.5 w-3.5" />
                            Ativar
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className={`font-medium ${quantidade <= 0 ? "text-red-600" : "text-slate-900"}`}>
                            {formatarQuantidade(quantidade)}
                          </span>
                          <button
                            onClick={() => iniciarEdicao(produto, loja.id)}
                            className="flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-sm hover:bg-slate-100"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Ajustar
                          </button>
                          <button
                            onClick={() => alternarAtivoNaLoja(produto, loja.id, false)}
                            disabled={alternandoEsta}
                            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-red-600 disabled:opacity-60"
                            title="Desativar nessa loja"
                          >
                            <PowerOff className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  );
                })}
                <td className="px-3 py-2 font-semibold">{formatarQuantidade(totalEstoque(produto))}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => abrirEdicao(produto)}
                      className="flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-sm hover:bg-slate-100"
                      title="Editar produto"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Editar
                    </button>
                    <button
                      onClick={() => desativar(produto)}
                      className="flex items-center gap-1 rounded border border-red-300 px-2 py-1 text-sm text-red-600 hover:bg-red-50"
                      title="Desativar produto"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Desativar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-between text-sm text-slate-600">
        <span>
          Página {pagina} de {ultimaPagina} — {total} produtos
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => carregar(pagina - 1)}
            disabled={pagina <= 1}
            className="flex items-center gap-1 rounded border border-slate-300 px-3 py-1.5 hover:bg-slate-100 disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
            Anterior
          </button>
          <button
            onClick={() => carregar(pagina + 1)}
            disabled={pagina >= ultimaPagina}
            className="flex items-center gap-1 rounded border border-slate-300 px-3 py-1.5 hover:bg-slate-100 disabled:opacity-40"
          >
            Próxima
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {modalAberto && (
        <ModalCadastro
          titulo={editandoId ? "Editar Produto" : "Novo Produto"}
          icone={Package}
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

            <div className="mb-3 grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm text-slate-500">Código interno</label>
                <input
                  value={form.codigoInterno}
                  onChange={(e) => campo("codigoInterno", e.target.value)}
                  className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-500">Marca</label>
                <input
                  value={form.marca}
                  onChange={(e) => campo("marca", e.target.value)}
                  className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="mb-3 grid grid-cols-3 gap-3">
              <div>
                <label className="mb-1 block text-sm text-slate-500">Unidade</label>
                <input
                  placeholder="UN"
                  value={form.unidade}
                  onChange={(e) => campo("unidade", e.target.value)}
                  className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-500">Preço custo</label>
                <CampoDinheiro
                  value={form.precoCusto}
                  onChange={(v) => campo("precoCusto", v)}
                  className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-500">Margem %</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0"
                  value={form.margemPercentual}
                  onChange={(e) => campo("margemPercentual", e.target.value)}
                  className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm text-slate-500">Preço venda</label>
                <CampoDinheiro
                  value={form.precoVenda}
                  onChange={(v) => campo("precoVenda", v)}
                  className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-500">Estoque mínimo</label>
                <input
                  type="number"
                  placeholder="0"
                  value={form.estoqueMinimo}
                  onChange={(e) => campo("estoqueMinimo", e.target.value)}
                  className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <label className="mb-1 block text-sm text-slate-500">Natureza</label>
            <div className="mb-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => campo("natureza", "produto")}
                className={`rounded border px-3 py-2 text-sm ${
                  form.natureza === "produto"
                    ? "border-blue-500 bg-blue-600 text-white"
                    : "border-slate-300 bg-white text-slate-600 hover:bg-slate-100"
                }`}
              >
                Produto
              </button>
              <button
                type="button"
                onClick={() => campo("natureza", "servico")}
                className={`rounded border px-3 py-2 text-sm ${
                  form.natureza === "servico"
                    ? "border-blue-500 bg-blue-600 text-white"
                    : "border-slate-300 bg-white text-slate-600 hover:bg-slate-100"
                }`}
              >
                Serviço
              </button>
            </div>

            {form.natureza === "produto" ? (
              <>
                <label className="mb-1 block text-sm text-slate-500">Grupo fiscal</label>
                <select
                  value={form.grupoFiscalId}
                  onChange={(e) => campo("grupoFiscalId", e.target.value)}
                  className="mb-4 w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                >
                  <option value="">Nenhum</option>
                  {gruposFiscais.map((grupo) => (
                    <option key={grupo.id} value={grupo.id}>
                      {grupo.nome}
                    </option>
                  ))}
                </select>
              </>
            ) : (
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
            )}

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
                {editandoId ? "Salvar" : "Cadastrar"}
              </button>
            </div>
          </form>
        </ModalCadastro>
      )}
    </div>
  );
}
