"use client";

import { AlertCircle, ArrowLeft, CheckCircle2, Inbox, Plus, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "@/lib/apiClient";
import { ModalCadastro } from "@/components/ModalCadastro";
import type { NotaFiscalTerceiro, NotaFiscalTerceiroItem, Produto } from "@/lib/types";

const ROTULO_SITUACAO: Record<string, string> = {
  resumo: "Resumo (aguardando XML)",
  completa: "Completa",
};

function LinhaItem({
  item,
  produtoSelecionado,
  onSelecionar,
  onCriarProduto,
}: {
  item: NotaFiscalTerceiroItem;
  produtoSelecionado: Produto | null;
  onSelecionar: (produto: Produto | null) => void;
  onCriarProduto: (item: NotaFiscalTerceiroItem) => void;
}) {
  const [busca, setBusca] = useState("");
  const [resultados, setResultados] = useState<Produto[]>([]);
  const [buscando, setBuscando] = useState(false);

  useEffect(() => {
    const termo = busca.trim();
    if (termo.length < 2) {
      setResultados([]);
      return;
    }
    const timer = setTimeout(() => {
      setBuscando(true);
      apiFetch<Produto[]>(`produtos?q=${encodeURIComponent(termo)}`)
        .then(setResultados)
        .finally(() => setBuscando(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [busca]);

  return (
    <tr className="divide-x divide-slate-200 border-t border-slate-200 align-top">
      <td className="px-3 py-2">
        {item.descricao}
        {item.codigo_produto_fornecedor && (
          <span className="ml-1 text-xs text-slate-400">(cód. fornecedor {item.codigo_produto_fornecedor})</span>
        )}
      </td>
      <td className="px-3 py-2 text-slate-500">{item.ean || "—"}</td>
      <td className="px-3 py-2 text-right">{Number(item.quantidade).toLocaleString("pt-BR")}</td>
      <td className="px-3 py-2 text-right">R$ {Number(item.valor_unitario).toFixed(2)}</td>
      <td className="px-3 py-2 text-right">R$ {Number(item.valor_total).toFixed(2)}</td>
      <td className="px-3 py-2">
        {produtoSelecionado ? (
          <div className="flex items-center justify-between gap-2">
            <span>{produtoSelecionado.descricao}</span>
            <button onClick={() => onSelecionar(null)} className="text-xs text-slate-400 hover:text-red-600">
              trocar
            </button>
          </div>
        ) : (
          <div className="relative">
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar produto..."
              className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-blue-500"
            />
            {busca.trim().length >= 2 && (
              <div className="absolute left-0 top-full z-10 mt-1 max-h-56 w-64 overflow-auto rounded border border-slate-200 bg-white shadow-lg">
                {buscando && <div className="px-3 py-2 text-xs text-slate-400">Buscando...</div>}
                {!buscando && resultados.length === 0 && (
                  <div className="px-3 py-2 text-xs text-slate-400">Nenhum produto encontrado.</div>
                )}
                {resultados.map((produto) => (
                  <button
                    key={produto.id}
                    onClick={() => onSelecionar(produto)}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-100"
                  >
                    {produto.descricao}
                    {produto.codigo_barras && <span className="ml-1 text-xs text-slate-400">{produto.codigo_barras}</span>}
                  </button>
                ))}
                <button
                  onClick={() => onCriarProduto(item)}
                  className="flex w-full items-center gap-1.5 border-t border-slate-100 px-3 py-2 text-left text-sm text-blue-600 hover:bg-blue-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Cadastrar produto novo
                </button>
              </div>
            )}
          </div>
        )}
      </td>
    </tr>
  );
}

export default function DetalheNotaEntradaPage() {
  const params = useParams<{ id: string }>();
  const [nota, setNota] = useState<NotaFiscalTerceiro | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [sincronizando, setSincronizando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [matches, setMatches] = useState<Record<number, Produto | null>>({});

  const [modalProdutoAberto, setModalProdutoAberto] = useState<NotaFiscalTerceiroItem | null>(null);
  const [novoProdutoDescricao, setNovoProdutoDescricao] = useState("");
  const [novoProdutoCodigoBarras, setNovoProdutoCodigoBarras] = useState("");
  const [novoProdutoPrecoCusto, setNovoProdutoPrecoCusto] = useState("");
  const [salvandoProduto, setSalvandoProduto] = useState(false);
  const [erroProduto, setErroProduto] = useState<string | null>(null);

  async function carregar() {
    try {
      const dados = await apiFetch<NotaFiscalTerceiro>(`notas-entrada/${params.id}`);
      setNota(dados);
      setMatches(
        Object.fromEntries((dados.itens ?? []).map((item) => [item.id, item.produto ?? null])),
      );
    } catch {
      setErro("Não foi possível carregar essa nota de entrada.");
    }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function sincronizarNovamente() {
    if (!nota) return;
    setSincronizando(true);
    setErro(null);
    try {
      await apiFetch("notas-entrada/sincronizar", {
        method: "POST",
        body: JSON.stringify({ loja_id: nota.loja_id }),
      });
      await carregar();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível sincronizar com a SEFAZ.");
    } finally {
      setSincronizando(false);
    }
  }

  function abrirCriacaoProduto(item: NotaFiscalTerceiroItem) {
    setModalProdutoAberto(item);
    setNovoProdutoDescricao(item.descricao);
    setNovoProdutoCodigoBarras(item.ean ?? "");
    setNovoProdutoPrecoCusto(item.valor_unitario);
    setErroProduto(null);
  }

  async function salvarNovoProduto(event: React.FormEvent) {
    event.preventDefault();
    if (!modalProdutoAberto) return;
    setSalvandoProduto(true);
    setErroProduto(null);

    try {
      const produto = await apiFetch<Produto>("produtos", {
        method: "POST",
        body: JSON.stringify({
          descricao: novoProdutoDescricao,
          codigo_barras: novoProdutoCodigoBarras || null,
          preco_custo: Number(novoProdutoPrecoCusto) || 0,
        }),
      });
      setMatches((atual) => ({ ...atual, [modalProdutoAberto.id]: produto }));
      setModalProdutoAberto(null);
    } catch (e) {
      setErroProduto(e instanceof ApiError ? e.message : "Não foi possível cadastrar o produto.");
    } finally {
      setSalvandoProduto(false);
    }
  }

  async function confirmarEntrada() {
    if (!nota) return;
    const itens = (nota.itens ?? [])
      .filter((item) => matches[item.id])
      .map((item) => ({ id: item.id, produto_id: matches[item.id]!.id }));

    if (itens.length === 0) {
      window.alert("Casa pelo menos um item com um produto antes de confirmar a entrada.");
      return;
    }

    if (!window.confirm(`Confirma a entrada de estoque de ${itens.length} item(ns)? Essa ação não pode ser desfeita.`)) {
      return;
    }

    setConfirmando(true);
    setErro(null);
    try {
      await apiFetch(`notas-entrada/${nota.id}/dar-entrada`, {
        method: "POST",
        body: JSON.stringify({ itens }),
      });
      await carregar();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível confirmar a entrada de estoque.");
    } finally {
      setConfirmando(false);
    }
  }

  if (erro && !nota) {
    return (
      <div className="text-slate-900">
        <p className="flex items-center gap-1.5 text-sm text-red-600">
          <AlertCircle className="h-4 w-4" />
          {erro}
        </p>
      </div>
    );
  }

  if (!nota) {
    return <div className="text-slate-500">Carregando...</div>;
  }

  const jaConfirmada = nota.entrada_estoque_em !== null;

  return (
    <div className="max-w-4xl text-slate-900">
      <Link href="/admin/notas-entrada" className="mb-4 flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" />
        Voltar
      </Link>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Inbox className="h-5 w-5 text-blue-600" />
          {nota.emitente_nome || nota.emitente_cnpj || "Nota de entrada"}
        </h2>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
          {ROTULO_SITUACAO[nota.situacao] ?? nota.situacao}
        </span>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 rounded border border-slate-200 bg-slate-50 p-4 text-sm sm:grid-cols-4">
        <div>
          <p className="text-slate-500">Loja</p>
          <p className="font-medium">{nota.loja?.nome ?? "—"}</p>
        </div>
        <div>
          <p className="text-slate-500">Data de emissão</p>
          <p className="font-medium">{nota.data_emissao ? new Date(nota.data_emissao).toLocaleString("pt-BR") : "—"}</p>
        </div>
        <div>
          <p className="text-slate-500">Valor total</p>
          <p className="font-medium">{nota.valor_total ? `R$ ${Number(nota.valor_total).toFixed(2)}` : "—"}</p>
        </div>
        <div>
          <p className="text-slate-500">Chave de acesso</p>
          <p className="font-mono text-xs">{nota.chave_acesso}</p>
        </div>
      </div>

      {erro && (
        <p className="mb-4 flex items-center gap-1.5 text-sm text-red-600">
          <AlertCircle className="h-4 w-4" />
          {erro}
        </p>
      )}

      {nota.situacao === "resumo" && (
        <div className="mb-6 rounded border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <p className="mb-3">
            Ainda não temos o XML completo dessa nota (a SEFAZ libera depois da manifestação de Ciência, que já foi
            enviada automaticamente) — sincronize novamente daqui a pouco pra tentar buscar os itens.
          </p>
          <button
            onClick={sincronizarNovamente}
            disabled={sincronizando}
            className="flex items-center gap-1.5 rounded bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${sincronizando ? "animate-spin" : ""}`} />
            {sincronizando ? "Sincronizando..." : "Sincronizar agora"}
          </button>
        </div>
      )}

      {nota.situacao === "completa" && (
        <>
          {jaConfirmada && (
            <p className="mb-4 flex items-center gap-1.5 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              <CheckCircle2 className="h-4 w-4" />
              Entrada de estoque confirmada em {new Date(nota.entrada_estoque_em!).toLocaleString("pt-BR")}.
            </p>
          )}

          <div className="overflow-auto rounded border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr className="divide-x divide-slate-200">
                  <th className="px-3 py-2">Descrição (nota)</th>
                  <th className="px-3 py-2">EAN</th>
                  <th className="px-3 py-2 text-right">Qtd.</th>
                  <th className="px-3 py-2 text-right">Vlr. unit.</th>
                  <th className="px-3 py-2 text-right">Total</th>
                  <th className="px-3 py-2">Produto do cadastro</th>
                </tr>
              </thead>
              <tbody>
                {(nota.itens ?? []).map((item) =>
                  jaConfirmada ? (
                    <tr key={item.id} className="divide-x divide-slate-200 border-t border-slate-200">
                      <td className="px-3 py-2">{item.descricao}</td>
                      <td className="px-3 py-2 text-slate-500">{item.ean || "—"}</td>
                      <td className="px-3 py-2 text-right">{Number(item.quantidade).toLocaleString("pt-BR")}</td>
                      <td className="px-3 py-2 text-right">R$ {Number(item.valor_unitario).toFixed(2)}</td>
                      <td className="px-3 py-2 text-right">R$ {Number(item.valor_total).toFixed(2)}</td>
                      <td className="px-3 py-2">{item.produto?.descricao ?? "— (sem entrada)"}</td>
                    </tr>
                  ) : (
                    <LinhaItem
                      key={item.id}
                      item={item}
                      produtoSelecionado={matches[item.id] ?? null}
                      onSelecionar={(produto) => setMatches((atual) => ({ ...atual, [item.id]: produto }))}
                      onCriarProduto={abrirCriacaoProduto}
                    />
                  ),
                )}
              </tbody>
            </table>
          </div>

          {!jaConfirmada && (
            <div className="mt-4 flex justify-end">
              <button
                onClick={confirmarEntrada}
                disabled={confirmando}
                className="flex items-center gap-2 rounded bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
              >
                <CheckCircle2 className="h-4 w-4" />
                {confirmando ? "Confirmando..." : "Confirmar entrada de estoque"}
              </button>
            </div>
          )}
        </>
      )}

      {modalProdutoAberto && (
        <ModalCadastro titulo="Novo Produto" icone={Plus} onFechar={() => setModalProdutoAberto(null)}>
          <form onSubmit={salvarNovoProduto}>
            <label className="mb-1 block text-sm text-slate-500">Descrição</label>
            <input
              autoFocus
              value={novoProdutoDescricao}
              onChange={(e) => setNovoProdutoDescricao(e.target.value)}
              required
              className="mb-3 w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
            />

            <div className="mb-4 grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm text-slate-500">Código de barras (opcional)</label>
                <input
                  value={novoProdutoCodigoBarras}
                  onChange={(e) => setNovoProdutoCodigoBarras(e.target.value)}
                  className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-500">Preço de custo</label>
                <input
                  type="number"
                  step="0.01"
                  value={novoProdutoPrecoCusto}
                  onChange={(e) => setNovoProdutoPrecoCusto(e.target.value)}
                  className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <p className="mb-4 text-xs text-slate-400">
              Preço de venda, grupo fiscal e estoque mínimo ficam com os valores padrão — dá pra completar depois em
              Produtos / Estoque.
            </p>

            {erroProduto && (
              <p className="mb-4 flex items-center gap-1.5 text-sm text-red-600">
                <AlertCircle className="h-4 w-4" />
                {erroProduto}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalProdutoAberto(null)}
                className="rounded border border-slate-300 px-4 py-2 text-slate-600 hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={salvandoProduto}
                className="flex items-center gap-2 rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-500 disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                {salvandoProduto ? "Salvando..." : "Cadastrar"}
              </button>
            </div>
          </form>
        </ModalCadastro>
      )}
    </div>
  );
}
