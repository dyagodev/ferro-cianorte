"use client";

import { AlertCircle, Check, ChevronLeft, ChevronRight, Package, Pencil, Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/apiClient";
import { CampoDinheiro } from "@/components/CampoDinheiro";
import type { Loja, Produto } from "@/lib/types";

type EdicaoEstoque = { produtoId: number; lojaId: number };

type PaginaProdutos = {
  data: Produto[];
  current_page: number;
  last_page: number;
  total: number;
};

const POR_PAGINA = 30;

export default function ProdutosPage() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [pagina, setPagina] = useState(1);
  const [ultimaPagina, setUltimaPagina] = useState(1);
  const [total, setTotal] = useState(0);
  const [busca, setBusca] = useState("");

  const [descricao, setDescricao] = useState("");
  const [codigoInterno, setCodigoInterno] = useState("");
  const [marca, setMarca] = useState("");
  const [unidade, setUnidade] = useState("UN");
  const [precoCusto, setPrecoCusto] = useState(0);
  const [margemPercentual, setMargemPercentual] = useState("");
  const [precoVenda, setPrecoVenda] = useState(0);
  const [estoqueMinimo, setEstoqueMinimo] = useState("");

  const [erro, setErro] = useState<string | null>(null);
  const [edicao, setEdicao] = useState<EdicaoEstoque | null>(null);
  const [valorEdicao, setValorEdicao] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function carregar(paginaAlvo = pagina, buscaAlvo = busca) {
    const query = new URLSearchParams({ page: String(paginaAlvo), per_page: String(POR_PAGINA) });
    if (buscaAlvo.trim()) query.set("q", buscaAlvo.trim());

    const [produtosResp, lojasResp] = await Promise.all([
      apiFetch<PaginaProdutos>(`produtos?${query.toString()}`),
      apiFetch<Loja[]>("lojas"),
    ]);
    setProdutos(produtosResp.data);
    setPagina(produtosResp.current_page);
    setUltimaPagina(produtosResp.last_page);
    setTotal(produtosResp.total);
    setLojas(lojasResp);
  }

  useEffect(() => {
    carregar(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Busca com debounce: sempre volta pra página 1 (um resultado filtrado não
  // faz sentido continuar na página 5 de antes).
  useEffect(() => {
    const timer = setTimeout(() => carregar(1, busca), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca]);

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

  async function criar(event: React.FormEvent) {
    event.preventDefault();
    setErro(null);
    try {
      await apiFetch("produtos", {
        method: "POST",
        body: JSON.stringify({
          descricao,
          codigo_interno: codigoInterno || null,
          marca: marca || null,
          unidade: unidade || "UN",
          preco_custo: precoCusto,
          margem_percentual: Number(margemPercentual) || 0,
          preco_venda: precoVenda,
          estoque_minimo: Number(estoqueMinimo) || 0,
        }),
      });
      setDescricao("");
      setCodigoInterno("");
      setMarca("");
      setUnidade("UN");
      setPrecoCusto(0);
      setMargemPercentual("");
      setPrecoVenda(0);
      setEstoqueMinimo("");
      await carregar();
    } catch {
      setErro("Não foi possível criar o produto.");
    }
  }

  function estoqueDoProduto(produto: Produto, lojaId: number): number {
    return Number(produto.estoques?.find((estoque) => estoque.loja_id === lojaId)?.quantidade ?? 0);
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

  return (
    <div className="text-slate-900">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
        <Package className="h-5 w-5 text-blue-600" />
        Produtos
      </h2>

      <form onSubmit={criar} className="mb-6 rounded border border-slate-200 bg-slate-50 p-4">
        <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <input
            placeholder="Descrição"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            required
            className="rounded border border-slate-300 bg-white px-3 py-2 lg:col-span-2"
          />
          <input
            placeholder="Código interno"
            value={codigoInterno}
            onChange={(e) => setCodigoInterno(e.target.value)}
            className="rounded border border-slate-300 bg-white px-3 py-2"
          />
          <input
            placeholder="Marca"
            value={marca}
            onChange={(e) => setMarca(e.target.value)}
            className="rounded border border-slate-300 bg-white px-3 py-2"
          />
          <label className="flex flex-col gap-1 text-sm text-slate-500">
            Unidade
            <input
              placeholder="UN"
              value={unidade}
              onChange={(e) => setUnidade(e.target.value)}
              className="rounded border border-slate-300 bg-white px-3 py-2 text-base text-slate-900"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-500">
            Preço custo
            <CampoDinheiro
              value={precoCusto}
              onChange={setPrecoCusto}
              className="rounded border border-slate-300 bg-white px-3 py-2 text-base text-slate-900"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-500">
            Margem %
            <input
              type="number"
              step="0.01"
              placeholder="0"
              value={margemPercentual}
              onChange={(e) => setMargemPercentual(e.target.value)}
              className="rounded border border-slate-300 bg-white px-3 py-2 text-base text-slate-900"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-500">
            Preço venda
            <CampoDinheiro
              value={precoVenda}
              onChange={setPrecoVenda}
              className="rounded border border-slate-300 bg-white px-3 py-2 text-base text-slate-900"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-500">
            Estoque mínimo
            <input
              type="number"
              placeholder="0"
              value={estoqueMinimo}
              onChange={(e) => setEstoqueMinimo(e.target.value)}
              className="rounded border border-slate-300 bg-white px-3 py-2 text-base text-slate-900"
            />
          </label>
        </div>
        <button className="flex items-center gap-1.5 rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-500">
          <Package className="h-4 w-4" />
          Adicionar produto
        </button>
      </form>

      {erro && (
        <p className="mb-4 flex items-center gap-1.5 text-sm text-red-600">
          <AlertCircle className="h-4 w-4" />
          {erro}
        </p>
      )}

      <div className="relative mb-3 max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por descrição ou código interno..."
          className="w-full rounded border border-slate-300 bg-white py-2 pl-9 pr-3 text-slate-900 outline-none focus:border-blue-500"
        />
      </div>

      <div className="overflow-auto rounded border border-slate-200">
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-sm text-slate-500">
            <tr>
              <th className="px-3 py-2">Descrição</th>
              <th className="px-3 py-2">Código Interno</th>
              <th className="px-3 py-2">Preço venda</th>
              <th className="px-3 py-2">Estoque Total</th>
              {lojas.map((loja) => (
                <th key={loja.id} className="px-3 py-2">Estoque {loja.nome}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {produtos.length === 0 && (
              <tr>
                <td colSpan={4 + lojas.length} className="px-3 py-8 text-center text-slate-500">
                  Nenhum produto encontrado{busca ? ` para "${busca}"` : ""}.
                </td>
              </tr>
            )}
            {produtos.map((produto) => (
              <tr key={produto.id} className="border-t border-slate-200">
                <td className="px-3 py-2">{produto.descricao}</td>
                <td className="px-3 py-2 text-slate-500">{produto.codigo_interno ?? "—"}</td>
                <td className="px-3 py-2">R$ {Number(produto.preco_venda).toFixed(2)}</td>
                <td className="px-3 py-2 font-semibold">{formatarQuantidade(totalEstoque(produto))}</td>
                {lojas.map((loja) => {
                  const quantidade = estoqueDoProduto(produto, loja.id);
                  const editandoEsta = edicao?.produtoId === produto.id && edicao.lojaId === loja.id;

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
                        </div>
                      )}
                    </td>
                  );
                })}
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
    </div>
  );
}
