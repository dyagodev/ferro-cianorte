"use client";

import { AlertCircle, Check, ChevronLeft, ChevronRight, Package, Pencil, X } from "lucide-react";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/apiClient";
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
  const [descricao, setDescricao] = useState("");
  const [codigoInterno, setCodigoInterno] = useState("");
  const [precoVenda, setPrecoVenda] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [edicao, setEdicao] = useState<EdicaoEstoque | null>(null);
  const [valorEdicao, setValorEdicao] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function carregar(paginaAlvo = pagina) {
    const [produtosResp, lojasResp] = await Promise.all([
      apiFetch<PaginaProdutos>(`produtos?page=${paginaAlvo}&per_page=${POR_PAGINA}`),
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

  function totalEstoque(produto: Produto): number {
    return produto.estoques?.reduce((soma, estoque) => soma + estoque.quantidade, 0) ?? 0;
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
          preco_venda: Number(precoVenda) || 0,
        }),
      });
      setDescricao("");
      setCodigoInterno("");
      setPrecoVenda("");
      await carregar();
    } catch {
      setErro("Não foi possível criar o produto.");
    }
  }

  function estoqueDoProduto(produto: Produto, lojaId: number): number {
    return produto.estoques?.find((estoque) => estoque.loja_id === lojaId)?.quantidade ?? 0;
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

      <form onSubmit={criar} className="mb-6 flex flex-wrap gap-2">
        <input
          placeholder="Descrição"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          required
          className="flex-1 rounded border border-slate-300 bg-slate-50 px-3 py-2"
        />
        <input
          placeholder="Código interno"
          value={codigoInterno}
          onChange={(e) => setCodigoInterno(e.target.value)}
          className="w-48 rounded border border-slate-300 bg-slate-50 px-3 py-2"
        />
        <input
          placeholder="Preço venda"
          type="number"
          step="0.01"
          value={precoVenda}
          onChange={(e) => setPrecoVenda(e.target.value)}
          className="w-32 rounded border border-slate-300 bg-slate-50 px-3 py-2"
        />
        <button className="flex items-center gap-1.5 rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-500">
          <Package className="h-4 w-4" />
          Adicionar
        </button>
      </form>

      {erro && (
        <p className="mb-4 flex items-center gap-1.5 text-sm text-red-600">
          <AlertCircle className="h-4 w-4" />
          {erro}
        </p>
      )}

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
            {produtos.map((produto) => (
              <tr key={produto.id} className="border-t border-slate-200">
                <td className="px-3 py-2">{produto.descricao}</td>
                <td className="px-3 py-2 text-slate-500">{produto.codigo_interno ?? "—"}</td>
                <td className="px-3 py-2">R$ {Number(produto.preco_venda).toFixed(2)}</td>
                <td className="px-3 py-2 font-semibold">{totalEstoque(produto)}</td>
                {lojas.map((loja) => {
                  const quantidade = estoqueDoProduto(produto, loja.id);
                  const editandoEsta = edicao?.produtoId === produto.id && edicao.lojaId === loja.id;

                  return (
                    <td key={loja.id} className="px-3 py-2">
                      {editandoEsta ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
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
                            {quantidade}
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
