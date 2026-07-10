"use client";

import { AlertTriangle, CreditCard, DollarSign, RefreshCw, ReceiptText, TrendingUp, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/apiClient";
import type { FormaPagamento, Loja } from "@/lib/types";

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

function hoje() {
  return new Date().toISOString().slice(0, 10);
}

type Dashboard = {
  vendasHoje: { quantidade_vendas: number; total: number };
  porFormaPagamento: { forma_pagamento: FormaPagamento; total: string }[];
  estoqueBaixoCount: number;
  topProdutosHoje: { produto_id: number; descricao: string; quantidade_total: string }[];
};

export default function AdminHome() {
  const [dados, setDados] = useState<Dashboard | null>(null);
  const [erro, setErro] = useState(false);
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [lojaId, setLojaId] = useState<number | null>(null);

  useEffect(() => {
    apiFetch<Loja[]>("lojas").then(setLojas);
  }, []);

  const carregarDados = useCallback(async (lojaFiltro: number | null) => {
    const data = hoje();
    const filtroLoja = lojaFiltro ? `&loja_id=${lojaFiltro}` : "";

    const [vendas, fechamento, estoque, produtos] = await Promise.all([
      apiFetch<{ totais: { quantidade_vendas: number; total: number } }>(
        `relatorios/vendas?data_inicio=${data}&data_fim=${data}${filtroLoja}`,
      ),
      apiFetch<{ por_forma_pagamento: Dashboard["porFormaPagamento"] }>(
        `relatorios/fechamento-caixa?data_inicio=${data}&data_fim=${data}${filtroLoja}`,
      ),
      apiFetch<{ itens: unknown[] }>(`relatorios/estoque-baixo${lojaFiltro ? `?loja_id=${lojaFiltro}` : ""}`),
      apiFetch<{ produtos: Dashboard["topProdutosHoje"] }>(
        `relatorios/produtos-mais-vendidos?data_inicio=${data}&data_fim=${data}&limit=5${filtroLoja}`,
      ),
    ]);

    setDados({
      vendasHoje: vendas.totais,
      porFormaPagamento: fechamento.por_forma_pagamento,
      estoqueBaixoCount: estoque.itens.length,
      topProdutosHoje: produtos.produtos,
    });
  }, []);

  useEffect(() => {
    carregarDados(lojaId).catch(() => setErro(true));
  }, [carregarDados, lojaId]);

  if (erro) return <p className="text-red-600">Não foi possível carregar o painel.</p>;
  if (!dados) return <p className="text-slate-500">Carregando painel...</p>;

  return (
    <div className="text-slate-900">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Painel do dia</h2>
        <div className="flex items-center gap-2">
          <select
            value={lojaId ?? ""}
            onChange={(e) => setLojaId(e.target.value ? Number(e.target.value) : null)}
            className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm"
          >
            <option value="">Todas as lojas</option>
            {lojas.map((loja) => (
              <option key={loja.id} value={loja.id}>
                {loja.nome}
              </option>
            ))}
          </select>
          <BotaoSincronizarDados onSincronizar={() => carregarDados(lojaId)} />
        </div>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <CardMetrica icone={ReceiptText} titulo="Vendas hoje" valor={String(dados.vendasHoje.quantidade_vendas)} />
        <CardMetrica icone={DollarSign} titulo="Faturamento hoje" valor={`R$ ${dados.vendasHoje.total.toFixed(2)}`} />
        <Link href="/admin/relatorios">
          <CardMetrica
            icone={AlertTriangle}
            titulo="Estoque abaixo do mínimo"
            valor={String(dados.estoqueBaixoCount)}
            destaque={dados.estoqueBaixoCount > 0}
          />
        </Link>
        <CardMetrica
          icone={CreditCard}
          titulo="Formas de pagamento hoje"
          valor={String(dados.porFormaPagamento.length)}
          subtitulo="tipos usados"
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h3 className="mb-2 flex items-center gap-1.5 font-medium text-slate-600">
            <CreditCard className="h-4 w-4" />
            Recebido hoje por forma de pagamento
          </h3>
          <ul className="divide-y divide-slate-200 rounded border border-slate-200">
            {dados.porFormaPagamento.map((item) => (
              <li key={item.forma_pagamento} className="flex justify-between px-3 py-2 text-sm">
                <span>{ROTULO_FORMA[item.forma_pagamento]}</span>
                <span>R$ {Number(item.total).toFixed(2)}</span>
              </li>
            ))}
            {dados.porFormaPagamento.length === 0 && (
              <li className="px-3 py-6 text-center text-sm text-slate-500">Nenhuma venda hoje ainda.</li>
            )}
          </ul>
        </div>

        <div>
          <h3 className="mb-2 flex items-center gap-1.5 font-medium text-slate-600">
            <TrendingUp className="h-4 w-4" />
            Mais vendidos hoje
          </h3>
          <ul className="divide-y divide-slate-200 rounded border border-slate-200">
            {dados.topProdutosHoje.map((produto, index) => (
              <li key={produto.produto_id} className="flex justify-between px-3 py-2 text-sm">
                <span>
                  {index + 1}. {produto.descricao}
                </span>
                <span>{Number(produto.quantidade_total)} un.</span>
              </li>
            ))}
            {dados.topProdutosHoje.length === 0 && (
              <li className="px-3 py-6 text-center text-sm text-slate-500">Nenhuma venda hoje ainda.</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

function BotaoSincronizarDados({ onSincronizar }: { onSincronizar: () => Promise<void> }) {
  const [estado, setEstado] = useState<"ocioso" | "sincronizando" | "concluido">("ocioso");

  async function sincronizar() {
    setEstado("sincronizando");
    try {
      await onSincronizar();
      setEstado("concluido");
    } finally {
      setTimeout(() => setEstado("ocioso"), 2500);
    }
  }

  return (
    <button
      onClick={sincronizar}
      disabled={estado === "sincronizando"}
      className="flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-60"
    >
      <RefreshCw className={`h-4 w-4 ${estado === "sincronizando" ? "animate-spin" : ""}`} />
      {estado === "sincronizando" && "Sincronizando..."}
      {estado === "concluido" && "Dados sincronizados!"}
      {estado === "ocioso" && "Sincronizar dados"}
    </button>
  );
}

function CardMetrica({
  icone: Icone,
  titulo,
  valor,
  subtitulo,
  destaque,
}: {
  icone: LucideIcon;
  titulo: string;
  valor: string;
  subtitulo?: string;
  destaque?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        destaque ? "border-amber-500 bg-amber-500/10" : "border-slate-200 bg-slate-50"
      }`}
    >
      <div className="mb-1 flex items-center gap-2">
        <Icone className={`h-4 w-4 ${destaque ? "text-amber-600" : "text-blue-600"}`} />
        <p className="text-sm text-slate-500">{titulo}</p>
      </div>
      <p className={`text-2xl font-semibold ${destaque ? "text-amber-600" : "text-slate-900"}`}>{valor}</p>
      {subtitulo && <p className="text-xs text-slate-500">{subtitulo}</p>}
    </div>
  );
}
