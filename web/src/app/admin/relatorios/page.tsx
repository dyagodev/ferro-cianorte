"use client";

import {
  AlertTriangle,
  BarChart3,
  CreditCard,
  Printer,
  ReceiptText,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/apiClient";
import type { FormaPagamento, Loja } from "@/lib/types";

type Aba = "vendas" | "fechamento" | "produtos" | "estoque";

const ABAS: { valor: Aba; rotulo: string; icone: LucideIcon }[] = [
  { valor: "vendas", rotulo: "Vendas por período", icone: ReceiptText },
  { valor: "fechamento", rotulo: "Fechamento de caixa", icone: CreditCard },
  { valor: "produtos", rotulo: "Produtos mais vendidos", icone: TrendingUp },
  { valor: "estoque", rotulo: "Estoque baixo", icone: AlertTriangle },
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
          <h1 className="text-xl font-bold">Ferro Cianorte — {tituloAba}</h1>
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
      </div>
    </div>
  );
}

type VendaResumo = {
  id: number;
  created_at: string;
  total: string;
  subtotal: string;
  desconto: string;
  loja: { nome: string };
  vendedor: { name: string };
  cliente: { nome: string } | null;
};

function RelatorioVendas({ query }: { query: string }) {
  const [dados, setDados] = useState<{ vendas: VendaResumo[]; totais: { quantidade_vendas: number; subtotal: number; desconto: number; total: number } } | null>(null);

  useEffect(() => {
    apiFetch<typeof dados>(`relatorios/vendas?${query}`).then(setDados);
  }, [query]);

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
            <tr>
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2">Data</th>
              <th className="px-3 py-2">Loja</th>
              <th className="px-3 py-2">Vendedor</th>
              <th className="px-3 py-2">Cliente</th>
              <th className="px-3 py-2">Total</th>
            </tr>
          </thead>
          <tbody>
            {dados.vendas.map((venda) => (
              <tr key={venda.id} className="border-t border-slate-200">
                <td className="px-3 py-2">{venda.id}</td>
                <td className="px-3 py-2">{new Date(venda.created_at).toLocaleString("pt-BR")}</td>
                <td className="px-3 py-2">{venda.loja.nome}</td>
                <td className="px-3 py-2">{venda.vendedor.name}</td>
                <td className="px-3 py-2">{venda.cliente?.nome ?? "—"}</td>
                <td className="px-3 py-2">R$ {Number(venda.total).toFixed(2)}</td>
              </tr>
            ))}
            {dados.vendas.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                  Nenhuma venda no período.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const ROTULO_FORMA: Record<FormaPagamento, string> = {
  boleto: "Boleto",
  cartao: "Cartão",
  dinheiro: "Dinheiro",
  cheque: "Cheque",
  crediario: "Crediário",
  pix: "Pix",
  a_prazo: "A Prazo",
  outros: "Outros",
};

function RelatorioFechamento({ query }: { query: string }) {
  const [dados, setDados] = useState<{
    por_forma_pagamento: { forma_pagamento: FormaPagamento; total: string }[];
    por_vendedor: { vendedor_id: number; vendedor_nome: string; total: string }[];
    total_geral: number;
  } | null>(null);

  useEffect(() => {
    apiFetch<typeof dados>(`relatorios/fechamento-caixa?${query}`).then(setDados);
  }, [query]);

  if (!dados) return <p className="text-slate-500">Carregando...</p>;

  return (
    <div className="grid gap-6 md:grid-cols-2">
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

      <p className="text-lg font-semibold text-slate-900 md:col-span-2">
        Total geral: R$ {dados.total_geral.toFixed(2)}
      </p>
    </div>
  );
}

function RelatorioProdutos({ query }: { query: string }) {
  const [produtos, setProdutos] = useState<{ produto_id: number; descricao: string; quantidade_total: string; valor_total: string }[] | null>(null);

  useEffect(() => {
    apiFetch<{ produtos: typeof produtos }>(`relatorios/produtos-mais-vendidos?${query}`).then((dados) => setProdutos(dados.produtos));
  }, [query]);

  if (!produtos) return <p className="text-slate-500">Carregando...</p>;

  return (
    <div className="overflow-auto rounded border border-slate-200">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-slate-500">
          <tr>
            <th className="px-3 py-2">Produto</th>
            <th className="px-3 py-2">Quantidade vendida</th>
            <th className="px-3 py-2">Valor total</th>
          </tr>
        </thead>
        <tbody>
          {produtos.map((produto, index) => (
            <tr key={produto.produto_id} className="border-t border-slate-200">
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
          <tr>
            <th className="px-3 py-2">Produto</th>
            <th className="px-3 py-2">Loja</th>
            <th className="px-3 py-2">Estoque atual</th>
            <th className="px-3 py-2">Estoque mínimo</th>
          </tr>
        </thead>
        <tbody>
          {itens.map((item, index) => (
            <tr key={`${item.produto_id}-${index}`} className="border-t border-slate-200">
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
