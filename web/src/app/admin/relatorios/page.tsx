"use client";

import {
  AlertCircle,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  BarChart3,
  CreditCard,
  History,
  Printer,
  ReceiptText,
  Send,
  TrendingUp,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "@/lib/apiClient";
import type { FormaPagamento, Loja, MovimentacaoEstoque, NotaFiscal } from "@/lib/types";

type Aba = "vendas" | "fechamento" | "produtos" | "estoque" | "historico_estoque";

const ABAS: { valor: Aba; rotulo: string; icone: LucideIcon }[] = [
  { valor: "vendas", rotulo: "Vendas por período", icone: ReceiptText },
  { valor: "fechamento", rotulo: "Fechamento de caixa", icone: CreditCard },
  { valor: "produtos", rotulo: "Produtos mais vendidos", icone: TrendingUp },
  { valor: "estoque", rotulo: "Estoque baixo", icone: AlertTriangle },
  { valor: "historico_estoque", rotulo: "Histórico de estoque", icone: History },
];

function hoje() {
  return new Date().toISOString().slice(0, 10);
}

export default function RelatoriosPage() {
  const [aba, setAba] = useState<Aba>("vendas");
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [lojaId, setLojaId] = useState<string>("");
  const [dataInicio, setDataInicio] = useState(hoje());
  const [dataFim, setDataFim] = useState(hoje());

  useEffect(() => {
    apiFetch<Loja[]>("lojas").then(setLojas);
  }, []);

  const filtros = new URLSearchParams({ data_inicio: dataInicio, data_fim: dataFim });
  if (lojaId) filtros.set("loja_id", lojaId);

  const lojaNome = lojaId ? lojas.find((loja) => String(loja.id) === lojaId)?.nome : "Todas as lojas";
  const tituloAba = ABAS.find((item) => item.valor === aba)?.rotulo ?? "";

  return (
    <div className="text-slate-900">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <BarChart3 className="h-5 w-5 text-blue-600" />
          Relatórios
        </h2>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
        >
          <Printer className="h-4 w-4" />
          Imprimir relatório
        </button>
      </div>

      <div className="mb-4 flex flex-wrap gap-1 border-b border-slate-200 print:hidden">
        {ABAS.map((item) => {
          const Icone = item.icone;
          return (
            <button
              key={item.valor}
              onClick={() => setAba(item.valor)}
              className={`flex items-center gap-1.5 rounded-t px-4 py-2 text-sm ${
                aba === item.valor
                  ? "border-b-2 border-blue-500 font-medium text-slate-900"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <Icone className="h-4 w-4" />
              {item.rotulo}
            </button>
          );
        })}
      </div>

      <div className="mb-6 flex flex-wrap items-end gap-3 print:hidden">
        {aba !== "estoque" && (
          <>
            <div>
              <label className="mb-1 block text-xs text-slate-500">De</label>
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="rounded border border-slate-300 bg-slate-50 px-2 py-1"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Até</label>
              <input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="rounded border border-slate-300 bg-slate-50 px-2 py-1"
              />
            </div>
          </>
        )}
        <div>
          <label className="mb-1 block text-xs text-slate-500">Loja</label>
          <select
            value={lojaId}
            onChange={(e) => setLojaId(e.target.value)}
            className="rounded border border-slate-300 bg-slate-50 px-2 py-1"
          >
            <option value="">Todas as lojas</option>
            {lojas.map((loja) => (
              <option key={loja.id} value={loja.id}>
                {loja.nome}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="relatorio-impressao">
        <div className="mb-4 hidden print:block">
          <h1 className="text-xl font-bold">DM Nexus — {tituloAba}</h1>
          <p className="text-sm">Loja: {lojaNome}</p>
          {aba !== "estoque" && (
            <p className="text-sm">
              Período: {dataInicio} a {dataFim}
            </p>
          )}
        </div>

        {aba === "vendas" && <RelatorioVendas query={filtros.toString()} />}
        {aba === "fechamento" && <RelatorioFechamento query={filtros.toString()} />}
        {aba === "produtos" && <RelatorioProdutos query={filtros.toString()} />}
        {aba === "estoque" && <RelatorioEstoqueBaixo lojaId={lojaId} />}
        {aba === "historico_estoque" && <RelatorioHistoricoEstoque query={filtros.toString()} />}
      </div>
    </div>
  );
}

type VendaItemResumo = {
  id: number;
  produto_id: number | null;
  servico_id: number | null;
  quantidade: string | number;
  preco_unitario: string;
  total: string;
  produto: { descricao: string } | null;
  servico?: { descricao: string } | null;
};

type VendaResumo = {
  id: number;
  created_at: string;
  total: string;
  subtotal: string;
  desconto: string;
  status: string;
  sync_conexao_id: number | null;
  loja: { nome: string };
  vendedor: { name: string };
  // Venda sincronizada do Link Pro guarda o vendedor de origem à parte —
  // "vendedor" acima é sempre o usuário de integração, não quem vendeu de
  // verdade.
  vendedor_externo_nome: string | null;
  cliente: { nome: string } | null;
  itens: VendaItemResumo[];
  pagamentos: { forma_pagamento: string; valor: string }[];
  notas_fiscais?: NotaFiscal[];
};

const ROTULO_TIPO_NOTA: Record<string, string> = { nfce: "NFC-e", nfe: "NF-e", nfse: "NFS-e" };

function corStatusNota(status: string): string {
  if (status === "authorized") return "bg-emerald-100 text-emerald-700";
  if (status === "rejected") return "bg-red-100 text-red-700";
  if (status === "canceled") return "bg-slate-200 text-slate-600";
  return "bg-amber-100 text-amber-700";
}

function rotuloStatusNota(status: string): string {
  if (status === "authorized") return "Autorizada";
  if (status === "rejected") return "Rejeitada";
  if (status === "canceled") return "Cancelada";
  return status;
}

function nomeVendedor(venda: VendaResumo): string {
  return venda.vendedor_externo_nome ?? venda.vendedor.name;
}

const CORES_FORMA: Record<string, string> = {
  boleto: "bg-amber-100 text-amber-800 border-amber-200",
  cartao: "bg-blue-100 text-blue-800 border-blue-200",
  cartao_debito: "bg-indigo-100 text-indigo-800 border-indigo-200",
  dinheiro: "bg-emerald-100 text-emerald-800 border-emerald-200",
  cheque: "bg-purple-100 text-purple-800 border-purple-200",
  crediario: "bg-orange-100 text-orange-800 border-orange-200",
  pix: "bg-teal-100 text-teal-800 border-teal-200",
  a_prazo: "bg-rose-100 text-rose-800 border-rose-200",
  outros: "bg-slate-100 text-slate-700 border-slate-200",
};

function coresForma(forma: string): string {
  return CORES_FORMA[forma] ?? "bg-slate-100 text-slate-700 border-slate-200";
}

function rotuloForma(forma: string): string {
  return (ROTULO_FORMA as Record<string, string>)[forma] ?? forma;
}

function RelatorioVendas({ query }: { query: string }) {
  const [dados, setDados] = useState<{ vendas: VendaResumo[]; totais: { quantidade_vendas: number; subtotal: number; desconto: number; total: number } } | null>(null);
  const [cancelando, setCancelando] = useState<number | null>(null);
  const [vendaDetalhe, setVendaDetalhe] = useState<VendaResumo | null>(null);

  function carregar() {
    apiFetch<typeof dados>(`relatorios/vendas?${query}`).then(setDados);
  }

  useEffect(carregar, [query]);

  async function cancelar(venda: VendaResumo) {
    if (!window.confirm(`Cancelar a venda #${venda.id}? O estoque dos itens será devolvido.`)) return;

    setCancelando(venda.id);
    try {
      await apiFetch(`vendas/${venda.id}/cancelar`, { method: "POST" });
      carregar();
    } catch {
      window.alert("Não foi possível cancelar esta venda.");
    } finally {
      setCancelando(null);
    }
  }

  if (!dados) return <p className="text-slate-500">Carregando...</p>;

  return (
    <div>
      <div className="mb-4 flex gap-6 text-sm text-slate-600">
        <span>Vendas: {dados.totais.quantidade_vendas}</span>
        <span>Subtotal: R$ {dados.totais.subtotal.toFixed(2)}</span>
        <span>Desconto: R$ {dados.totais.desconto.toFixed(2)}</span>
        <span className="font-semibold text-slate-900">Total: R$ {dados.totais.total.toFixed(2)}</span>
      </div>

      <div className="overflow-auto rounded border border-slate-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr className="divide-x divide-slate-200">
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2">Data</th>
              <th className="px-3 py-2">Origem</th>
              <th className="px-3 py-2">Loja</th>
              <th className="px-3 py-2">Vendedor</th>
              <th className="px-3 py-2">Cliente</th>
              <th className="px-3 py-2">Pagamento</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Total</th>
              <th className="px-3 py-2 print:hidden" />
            </tr>
          </thead>
          <tbody>
            {dados.vendas.map((venda) => {
              const cancelada = venda.status === "cancelada";
              return (
                <tr
                  key={venda.id}
                  onClick={() => setVendaDetalhe(venda)}
                  className={`cursor-pointer divide-x divide-slate-200 border-t border-slate-200 hover:bg-slate-100 ${cancelada ? "text-slate-400" : ""}`}
                >
                  <td className="px-3 py-2">{venda.id}</td>
                  <td className="px-3 py-2">{new Date(venda.created_at).toLocaleString("pt-BR")}</td>
                  <td className="px-3 py-2">
                    {venda.sync_conexao_id ? (
                      <span className="rounded-full border border-indigo-200 bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
                        Link Pro
                      </span>
                    ) : (
                      <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                        PDV
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">{venda.loja?.nome ?? "—"}</td>
                  <td className="px-3 py-2">{nomeVendedor(venda)}</td>
                  <td className="px-3 py-2">{venda.cliente?.nome ?? "—"}</td>
                  <td className="px-3 py-2">
                    {venda.pagamentos.length === 0 ? (
                      <span className="text-slate-400">—</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {venda.pagamentos.map((pag, idx) => (
                          <span
                            key={idx}
                            className={`rounded-full border px-2 py-0.5 text-xs font-medium ${coresForma(pag.forma_pagamento)}`}
                          >
                            {rotuloForma(pag.forma_pagamento)}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        cancelada ? "bg-slate-200 text-slate-600" : "bg-emerald-100 text-emerald-700"
                      }`}
                    >
                      {cancelada ? "Cancelada" : "Concluída"}
                    </span>
                  </td>
                  <td className={`px-3 py-2 ${cancelada ? "line-through" : ""}`}>
                    R$ {Number(venda.total).toFixed(2)}
                  </td>
                  <td className="px-3 py-2 print:hidden">
                    {!cancelada && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          cancelar(venda);
                        }}
                        disabled={cancelando === venda.id}
                        className="rounded border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        Cancelar
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {dados.vendas.length === 0 && (
              <tr>
                <td colSpan={10} className="px-3 py-6 text-center text-slate-500">
                  Nenhuma venda no período.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {vendaDetalhe && (
        <VendaDetalheModal
          venda={vendaDetalhe}
          onFechar={() => setVendaDetalhe(null)}
          aposEmitir={carregar}
        />
      )}
    </div>
  );
}

function VendaDetalheModal({
  venda,
  onFechar,
  aposEmitir,
}: {
  venda: VendaResumo;
  onFechar: () => void;
  aposEmitir: () => void;
}) {
  const cancelada = venda.status === "cancelada";
  const [notas, setNotas] = useState<NotaFiscal[]>(venda.notas_fiscais ?? []);
  const [emitindo, setEmitindo] = useState(false);
  const [erroEmissao, setErroEmissao] = useState<string | null>(null);
  const [cancelandoId, setCancelandoId] = useState<number | null>(null);
  const [erroCancelamento, setErroCancelamento] = useState<string | null>(null);

  const jaAutorizada = notas.some((n) => n.status === "authorized");

  async function cancelarNota(nota: NotaFiscal) {
    const justificativa = window.prompt(
      "Justificativa do cancelamento (mín. 15 caracteres, exigido pela SEFAZ):",
    );
    if (!justificativa) return;
    if (justificativa.trim().length < 15) {
      window.alert("A justificativa precisa ter pelo menos 15 caracteres.");
      return;
    }
    if (!window.confirm("Confirma o cancelamento dessa NFC-e na SEFAZ? Essa ação não pode ser desfeita.")) {
      return;
    }
    setCancelandoId(nota.id);
    setErroCancelamento(null);
    try {
      const atualizada = await apiFetch<NotaFiscal>(`notas-fiscais/${nota.id}/cancelar`, {
        method: "POST",
        body: JSON.stringify({ justificativa: justificativa.trim() }),
      });
      setNotas((atual) => atual.map((n) => (n.id === atualizada.id ? atualizada : n)));
      aposEmitir();
    } catch (e) {
      const mensagem =
        e instanceof ApiError ? (e.body as { message?: string }).message : undefined;
      setErroCancelamento(mensagem ?? "Não foi possível cancelar a nota fiscal.");
    } finally {
      setCancelandoId(null);
    }
  }

  async function emitirNota() {
    setEmitindo(true);
    setErroEmissao(null);
    try {
      const resposta = await apiFetch<{ notas_fiscais: NotaFiscal[] }>(`vendas/${venda.id}/emitir-nota`, {
        method: "POST",
      });
      setNotas(resposta.notas_fiscais);
      aposEmitir();
    } catch (e) {
      if (e instanceof ApiError) {
        const corpo = e.body as { message?: string; notas_fiscais?: NotaFiscal[] };
        setErroEmissao(corpo.message ?? "Não foi possível emitir a nota fiscal.");
        if (corpo.notas_fiscais) setNotas(corpo.notas_fiscais);
      } else {
        setErroEmissao("Não foi possível emitir a nota fiscal.");
      }
    } finally {
      setEmitindo(false);
    }
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onFechar();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onFechar]);

  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/60 print:hidden" onClick={onFechar}>
      <div
        className="w-full max-w-lg rounded-lg border border-slate-300 bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">Venda #{venda.id}</h3>
          <button onClick={onFechar} className="text-slate-500 hover:text-slate-900">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3 text-sm text-slate-600">
          <div>
            <span className="block text-xs text-slate-400">Data</span>
            {new Date(venda.created_at).toLocaleString("pt-BR")}
          </div>
          <div>
            <span className="block text-xs text-slate-400">Status</span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cancelada ? "bg-slate-200 text-slate-600" : "bg-emerald-100 text-emerald-700"}`}>
              {cancelada ? "Cancelada" : "Concluída"}
            </span>
          </div>
          <div>
            <span className="block text-xs text-slate-400">Loja</span>
            {venda.loja?.nome ?? "—"}
          </div>
          <div>
            <span className="block text-xs text-slate-400">Vendedor</span>
            {nomeVendedor(venda)}
          </div>
          <div>
            <span className="block text-xs text-slate-400">Cliente</span>
            {venda.cliente?.nome ?? "não informado"}
          </div>
        </div>

        <div className="mb-4 rounded border border-slate-200 bg-slate-50 p-3 print:hidden">
          <div className="mb-1 flex items-center justify-between">
            <p className="text-sm font-medium text-slate-600">Nota fiscal</p>
            {!cancelada && !jaAutorizada && (
              <button
                onClick={emitirNota}
                disabled={emitindo}
                className="flex items-center gap-1.5 rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-50"
              >
                <Send className="h-3.5 w-3.5" />
                {emitindo ? "Emitindo..." : "Emitir nota fiscal"}
              </button>
            )}
          </div>

          {notas.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhuma nota emitida ainda.</p>
          ) : (
            <ul className="space-y-1">
              {notas.map((nota) => (
                <li key={nota.id} className="border-b border-slate-100 py-1 text-sm last:border-0">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">{ROTULO_TIPO_NOTA[nota.tipo] ?? nota.tipo}</span>
                  <span className="flex items-center gap-2">
                    {(nota.tipo === "nfce" || nota.tipo === "nfe") && nota.status === "authorized" && (
                      <a
                        href={`/api/proxy/notas-fiscais/${nota.id}/danfe`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Baixar DANFE
                      </a>
                    )}
                    {(nota.tipo === "nfce" || nota.tipo === "nfe") && nota.status === "authorized" && (
                      <a
                        href={`/api/proxy/notas-fiscais/${nota.id}/xml`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Baixar XML
                      </a>
                    )}
                    {(nota.tipo === "nfce" || nota.tipo === "nfe") && nota.status === "authorized" && (
                      <button
                        onClick={() => cancelarNota(nota)}
                        disabled={cancelandoId === nota.id}
                        className="text-xs text-red-600 hover:underline disabled:opacity-50"
                      >
                        {cancelandoId === nota.id ? "Cancelando..." : "Cancelar"}
                      </button>
                    )}
                    {nota.url_danfe && (
                      <a
                        href={nota.url_danfe}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Ver nota (SEFAZ)
                      </a>
                    )}
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${corStatusNota(nota.status)}`}>
                      {rotuloStatusNota(nota.status)}
                    </span>
                  </span>
                </div>
                  {nota.status === "rejected" && nota.mensagem_retorno && (
                    <p className="mt-1 text-xs text-red-600">{nota.mensagem_retorno}</p>
                  )}
                </li>
              ))}
            </ul>
          )}

          {erroEmissao && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-red-600">
              <AlertCircle className="h-3.5 w-3.5" />
              {erroEmissao}
            </p>
          )}
          {erroCancelamento && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-red-600">
              <AlertCircle className="h-3.5 w-3.5" />
              {erroCancelamento}
            </p>
          )}
        </div>

        <p className="mb-2 text-sm font-medium text-slate-600">Itens</p>
        <div className="mb-4 max-h-56 overflow-auto rounded border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr className="divide-x divide-slate-200">
                <th className="px-3 py-2">Produto</th>
                <th className="px-3 py-2">Qtd.</th>
                <th className="px-3 py-2">Preço unit.</th>
                <th className="px-3 py-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {venda.itens.map((item) => (
                <tr key={item.id} className="divide-x divide-slate-200 border-t border-slate-200 text-slate-900">
                  <td className="px-3 py-2">{item.produto?.descricao ?? item.servico?.descricao ?? `#${item.produto_id ?? item.servico_id}`}</td>
                  <td className="px-3 py-2">{Number(item.quantidade)}</td>
                  <td className="px-3 py-2">R$ {Number(item.preco_unitario).toFixed(2)}</td>
                  <td className="px-3 py-2">R$ {Number(item.total).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mb-2 text-sm font-medium text-slate-600">Pagamentos</p>
        <ul className="mb-4 divide-y divide-slate-200 rounded border border-slate-200">
          {venda.pagamentos.map((pagamento, idx) => (
            <li key={idx} className="flex justify-between px-3 py-2 text-sm text-slate-900">
              <span>{rotuloForma(pagamento.forma_pagamento)}</span>
              <span>R$ {Number(pagamento.valor).toFixed(2)}</span>
            </li>
          ))}
        </ul>

        <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>R$ {Number(venda.subtotal).toFixed(2)}</span>
          </div>
          {Number(venda.desconto) > 0 && (
            <div className="flex justify-between text-amber-600">
              <span>Desconto</span>
              <span>-R$ {Number(venda.desconto).toFixed(2)}</span>
            </div>
          )}
          <div className="mt-1 flex justify-between border-t border-slate-200 pt-1 text-base font-semibold text-slate-900">
            <span>Total</span>
            <span>R$ {Number(venda.total).toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

const ROTULO_FORMA: Record<FormaPagamento, string> = {
  boleto: "Boleto",
  cartao: "Cartão Crédito",
  cartao_debito: "Cartão Débito",
  dinheiro: "Dinheiro",
  cheque: "Cheque",
  crediario: "Crediário",
  pix: "Pix",
  a_prazo: "A Prazo",
  outros: "Outros",
};

type TipoMovimentacao = "abertura" | "sangria" | "fechamento";

type Movimentacao = {
  id: number;
  tipo: TipoMovimentacao;
  valor: string;
  observacao: string | null;
  created_at: string;
  loja: { nome: string };
  usuario: { name: string };
};

const ROTULO_TIPO_MOVIMENTACAO: Record<TipoMovimentacao, string> = {
  abertura: "Abertura",
  sangria: "Sangria",
  fechamento: "Fechamento",
};

const CORES_TIPO_MOVIMENTACAO: Record<TipoMovimentacao, string> = {
  abertura: "bg-blue-100 text-blue-800 border-blue-200",
  sangria: "bg-rose-100 text-rose-800 border-rose-200",
  fechamento: "bg-slate-200 text-slate-700 border-slate-300",
};

function RelatorioFechamento({ query }: { query: string }) {
  const [dados, setDados] = useState<{
    quantidade_vendas: number;
    por_forma_pagamento: { forma_pagamento: FormaPagamento; total: string }[];
    por_vendedor: { vendedor_id: number; vendedor_nome: string; total: string }[];
    total_geral: number;
    movimentacoes: Movimentacao[];
    total_sangrias: number;
  } | null>(null);

  useEffect(() => {
    apiFetch<typeof dados>(`relatorios/fechamento-caixa?${query}`).then(setDados);
  }, [query]);

  if (!dados) return <p className="text-slate-500">Carregando...</p>;

  return (
    <div>
      <div className="mb-6 grid gap-6 md:grid-cols-2">
        <div>
          <h3 className="mb-2 flex items-center gap-1.5 font-medium text-slate-600">
            <CreditCard className="h-4 w-4" />
            Por forma de pagamento
          </h3>
          <ul className="divide-y divide-slate-200 rounded border border-slate-200">
            {dados.por_forma_pagamento.map((item) => (
              <li key={item.forma_pagamento} className="flex justify-between px-3 py-2 text-sm">
                <span>{ROTULO_FORMA[item.forma_pagamento]}</span>
                <span>R$ {Number(item.total).toFixed(2)}</span>
              </li>
            ))}
            {dados.por_forma_pagamento.length === 0 && (
              <li className="px-3 py-6 text-center text-sm text-slate-500">Nenhum recebimento no período.</li>
            )}
          </ul>
        </div>

        <div>
          <h3 className="mb-2 font-medium text-slate-600">Por vendedor</h3>
          <ul className="divide-y divide-slate-200 rounded border border-slate-200">
            {dados.por_vendedor.map((item) => (
              <li key={item.vendedor_id} className="flex justify-between px-3 py-2 text-sm">
                <span>{item.vendedor_nome}</span>
                <span>R$ {Number(item.total).toFixed(2)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-6 text-sm text-slate-600">
        <span>Vendas: {dados.quantidade_vendas}</span>
        <span>Sangrias: R$ {dados.total_sangrias.toFixed(2)}</span>
        <span className="text-lg font-semibold text-slate-900">Total geral: R$ {dados.total_geral.toFixed(2)}</span>
      </div>

      <h3 className="mb-2 font-medium text-slate-600">Movimentações de caixa</h3>
      <div className="overflow-auto rounded border border-slate-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr className="divide-x divide-slate-200">
              <th className="px-3 py-2">Data</th>
              <th className="px-3 py-2">Tipo</th>
              <th className="px-3 py-2">Loja</th>
              <th className="px-3 py-2">Usuário</th>
              <th className="px-3 py-2">Valor</th>
              <th className="px-3 py-2">Observação</th>
            </tr>
          </thead>
          <tbody>
            {dados.movimentacoes.map((mov) => (
              <tr key={mov.id} className="divide-x divide-slate-200 border-t border-slate-200">
                <td className="px-3 py-2">{new Date(mov.created_at).toLocaleString("pt-BR")}</td>
                <td className="px-3 py-2">
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${CORES_TIPO_MOVIMENTACAO[mov.tipo]}`}>
                    {ROTULO_TIPO_MOVIMENTACAO[mov.tipo]}
                  </span>
                </td>
                <td className="px-3 py-2">{mov.loja.nome}</td>
                <td className="px-3 py-2">{mov.usuario.name}</td>
                <td className="px-3 py-2">R$ {Number(mov.valor).toFixed(2)}</td>
                <td className="px-3 py-2 text-slate-500">{mov.observacao ?? "—"}</td>
              </tr>
            ))}
            {dados.movimentacoes.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                  Nenhuma movimentação de caixa no período.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type ColunaProdutos = "descricao" | "quantidade_total" | "valor_total";

function RelatorioProdutos({ query }: { query: string }) {
  const [produtos, setProdutos] = useState<{ produto_id: number; descricao: string; quantidade_total: string; valor_total: string }[] | null>(null);
  const [ordenacao, setOrdenacao] = useState<{ coluna: ColunaProdutos; direcao: "asc" | "desc" }>({
    coluna: "quantidade_total",
    direcao: "desc",
  });

  useEffect(() => {
    const params = new URLSearchParams(query);
    params.set("sort", ordenacao.coluna);
    params.set("direction", ordenacao.direcao);
    apiFetch<{ produtos: typeof produtos }>(`relatorios/produtos-mais-vendidos?${params.toString()}`).then((dados) => setProdutos(dados.produtos));
  }, [query, ordenacao]);

  function alternarOrdenacao(coluna: ColunaProdutos) {
    setOrdenacao((atual) => {
      if (atual.coluna === coluna) {
        return { coluna, direcao: atual.direcao === "asc" ? "desc" : "asc" };
      }
      return { coluna, direcao: coluna === "descricao" ? "asc" : "desc" };
    });
  }

  if (!produtos) return <p className="text-slate-500">Carregando...</p>;

  const colunas: { chave: ColunaProdutos; rotulo: string }[] = [
    { chave: "descricao", rotulo: "Produto" },
    { chave: "quantidade_total", rotulo: "Quantidade vendida" },
    { chave: "valor_total", rotulo: "Valor total" },
  ];

  return (
    <div className="overflow-auto rounded border border-slate-200">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-slate-500">
          <tr className="divide-x divide-slate-200">
            {colunas.map(({ chave, rotulo }) => {
              const ativa = ordenacao.coluna === chave;
              const Icone = ativa ? (ordenacao.direcao === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
              return (
                <th key={chave} className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => alternarOrdenacao(chave)}
                    className={`flex items-center gap-1 font-medium hover:text-slate-700 ${ativa ? "text-slate-700" : ""}`}
                  >
                    {rotulo}
                    <Icone className="h-3.5 w-3.5" />
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {produtos.map((produto, index) => (
            <tr key={produto.produto_id} className="divide-x divide-slate-200 border-t border-slate-200">
              <td className="px-3 py-2">
                {index + 1}. {produto.descricao}
              </td>
              <td className="px-3 py-2">{Number(produto.quantidade_total)}</td>
              <td className="px-3 py-2">R$ {Number(produto.valor_total).toFixed(2)}</td>
            </tr>
          ))}
          {produtos.length === 0 && (
            <tr>
              <td colSpan={3} className="px-3 py-6 text-center text-slate-500">
                Nenhuma venda no período.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function RelatorioEstoqueBaixo({ lojaId }: { lojaId: string }) {
  const [itens, setItens] = useState<{ produto_id: number; descricao: string; loja_nome: string; quantidade_atual: number; estoque_minimo: number }[] | null>(null);

  useEffect(() => {
    const query = lojaId ? `?loja_id=${lojaId}` : "";
    apiFetch<{ itens: typeof itens }>(`relatorios/estoque-baixo${query}`).then((dados) => setItens(dados.itens));
  }, [lojaId]);

  if (!itens) return <p className="text-slate-500">Carregando...</p>;

  return (
    <div className="overflow-auto rounded border border-slate-200">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-slate-500">
          <tr className="divide-x divide-slate-200">
            <th className="px-3 py-2">Produto</th>
            <th className="px-3 py-2">Loja</th>
            <th className="px-3 py-2">Estoque atual</th>
            <th className="px-3 py-2">Estoque mínimo</th>
          </tr>
        </thead>
        <tbody>
          {itens.map((item, index) => (
            <tr key={`${item.produto_id}-${index}`} className="divide-x divide-slate-200 border-t border-slate-200">
              <td className="px-3 py-2">{item.descricao}</td>
              <td className="px-3 py-2">{item.loja_nome}</td>
              <td className="px-3 py-2 text-red-600">{item.quantidade_atual}</td>
              <td className="px-3 py-2">{item.estoque_minimo}</td>
            </tr>
          ))}
          {itens.length === 0 && (
            <tr>
              <td colSpan={4} className="px-3 py-6 text-center text-slate-500">
                Nenhum produto abaixo do estoque mínimo. 🎉
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

const ROTULO_TIPO_MOVIMENTACAO_ESTOQUE: Record<string, string> = {
  venda: "Venda",
  cancelamento_venda: "Cancelamento de venda",
  transferencia_saida: "Transferência (saída)",
  transferencia_entrada: "Transferência (entrada)",
  transferencia_estorno: "Transferência (estorno)",
  sincronizacao_linkpro: "Sincronização Link Pro",
  reconciliacao_linkpro: "Reconciliação Link Pro",
  ajuste_manual: "Ajuste manual",
};

function corTipoMovimentacaoEstoque(tipo: string): string {
  if (tipo === "venda" || tipo === "transferencia_saida") return "bg-red-100 text-red-700";
  if (tipo === "cancelamento_venda" || tipo === "transferencia_entrada" || tipo === "transferencia_estorno") {
    return "bg-emerald-100 text-emerald-700";
  }
  if (tipo === "ajuste_manual") return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-600";
}

type PaginaMovimentacoes = {
  data: MovimentacaoEstoque[];
  current_page: number;
  last_page: number;
};

function RelatorioHistoricoEstoque({ query }: { query: string }) {
  const [dados, setDados] = useState<PaginaMovimentacoes | null>(null);
  const [pagina, setPagina] = useState(1);
  const [tipo, setTipo] = useState("");
  const [buscaProduto, setBuscaProduto] = useState("");

  useEffect(() => {
    setPagina(1);
  }, [query, tipo]);

  useEffect(() => {
    const params = new URLSearchParams(query);
    params.set("page", String(pagina));
    if (tipo) params.set("tipo", tipo);
    apiFetch<PaginaMovimentacoes>(`relatorios/estoque-historico?${params.toString()}`).then(setDados);
  }, [query, tipo, pagina]);

  const linhas = (dados?.data ?? []).filter((mov) =>
    buscaProduto.trim() === ""
      ? true
      : mov.produto?.descricao.toLowerCase().includes(buscaProduto.trim().toLowerCase()) ||
        mov.produto?.codigo_interno?.toLowerCase().includes(buscaProduto.trim().toLowerCase()),
  );

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-3 print:hidden">
        <div>
          <label className="mb-1 block text-xs text-slate-500">Tipo de movimento</label>
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            className="rounded border border-slate-300 bg-slate-50 px-2 py-1 text-sm"
          >
            <option value="">Todos</option>
            {Object.entries(ROTULO_TIPO_MOVIMENTACAO_ESTOQUE).map(([valor, rotulo]) => (
              <option key={valor} value={valor}>
                {rotulo}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">Filtrar produto (nessa página)</label>
          <input
            value={buscaProduto}
            onChange={(e) => setBuscaProduto(e.target.value)}
            placeholder="Descrição ou código..."
            className="rounded border border-slate-300 bg-slate-50 px-2 py-1 text-sm"
          />
        </div>
      </div>

      <div className="overflow-auto rounded border border-slate-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr className="divide-x divide-slate-200">
              <th className="px-3 py-2">Data</th>
              <th className="px-3 py-2">Produto</th>
              <th className="px-3 py-2">Loja</th>
              <th className="px-3 py-2">Tipo</th>
              <th className="px-3 py-2">Antes</th>
              <th className="px-3 py-2">Depois</th>
              <th className="px-3 py-2">Variação</th>
              <th className="px-3 py-2">Quem</th>
              <th className="px-3 py-2">Observação</th>
            </tr>
          </thead>
          <tbody>
            {!dados && (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-slate-500">
                  Carregando...
                </td>
              </tr>
            )}
            {dados && linhas.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-slate-500">
                  Nenhuma movimentação encontrada.
                </td>
              </tr>
            )}
            {linhas.map((mov) => (
              <tr key={mov.id} className="divide-x divide-slate-200 border-t border-slate-200">
                <td className="px-3 py-2 whitespace-nowrap">{new Date(mov.created_at).toLocaleString("pt-BR")}</td>
                <td className="px-3 py-2">
                  {mov.produto?.descricao ?? `#${mov.produto_id}`}
                  {mov.produto?.codigo_interno && (
                    <span className="ml-1 text-xs text-slate-400">({mov.produto.codigo_interno})</span>
                  )}
                </td>
                <td className="px-3 py-2">{mov.loja?.nome ?? "—"}</td>
                <td className="px-3 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${corTipoMovimentacaoEstoque(mov.tipo)}`}>
                    {ROTULO_TIPO_MOVIMENTACAO_ESTOQUE[mov.tipo] ?? mov.tipo}
                  </span>
                </td>
                <td className="px-3 py-2">{Number(mov.quantidade_antes).toFixed(3)}</td>
                <td className="px-3 py-2">{Number(mov.quantidade_depois).toFixed(3)}</td>
                <td className={`px-3 py-2 font-medium ${mov.delta >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {mov.delta >= 0 ? "+" : ""}
                  {mov.delta.toFixed(3)}
                </td>
                <td className="px-3 py-2">{mov.usuario?.name ?? "Sistema"}</td>
                <td className="px-3 py-2 max-w-xs truncate text-slate-500" title={mov.observacao ?? undefined}>
                  {mov.observacao ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {dados && dados.last_page > 1 && (
        <div className="mt-3 flex items-center justify-between text-sm text-slate-600 print:hidden">
          <span>
            Página {dados.current_page} de {dados.last_page}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPagina((p) => Math.max(1, p - 1))}
              disabled={dados.current_page <= 1}
              className="rounded border border-slate-300 px-3 py-1 hover:bg-slate-100 disabled:opacity-40"
            >
              Anterior
            </button>
            <button
              onClick={() => setPagina((p) => p + 1)}
              disabled={dados.current_page >= dados.last_page}
              className="rounded border border-slate-300 px-3 py-1 hover:bg-slate-100 disabled:opacity-40"
            >
              Próxima
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
