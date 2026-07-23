"use client";

import {
  AlertCircle,
  Banknote,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  CreditCard,
  FileText,
  HandCoins,
  MoreHorizontal,
  Plus,
  QrCode,
  UserRound,
  type LucideIcon,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { FORMAS_PAGAMENTO, type FormaPagamento } from "@/lib/types";

type Pagamento = { forma_pagamento: FormaPagamento; valor: number };

// Estado local de cada linha usa valor como string (input controlado) —
// só vira number na hora de somar/confirmar.
type LinhaPagamento = { forma: FormaPagamento; valor: string };

const ICONES_FORMA_PAGAMENTO: Record<FormaPagamento, LucideIcon> = {
  boleto: FileText,
  cartao: CreditCard,
  cartao_debito: CreditCard,
  dinheiro: Banknote,
  cheque: HandCoins,
  crediario: HandCoins,
  pix: QrCode,
  a_prazo: CalendarClock,
  outros: MoreHorizontal,
};

export default function PagamentoModal({
  total,
  clienteNome,
  possuiEmissaoFiscalConfigurada,
  onFechar,
  onConfirmar,
}: {
  total: number;
  clienteNome: string;
  possuiEmissaoFiscalConfigurada: boolean;
  onFechar: () => void;
  onConfirmar: (pagamentos: Pagamento[], emitirNotaFiscal: boolean) => Promise<void>;
}) {
  const [linhas, setLinhas] = useState<LinhaPagamento[]>([{ forma: "dinheiro", valor: total.toFixed(2) }]);
  const [emitirNotaFiscal, setEmitirNotaFiscal] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const totalPago = useMemo(() => linhas.reduce((soma, l) => soma + (Number(l.valor) || 0), 0), [linhas]);
  const saldoRestante = Math.max(0, total - totalPago);
  // Troco só é dado em dinheiro — se a divisão só tem cartão/pix/etc. e
  // ainda assim "sobrou" valor, não é troco, é erro de digitação (bloqueado
  // na validação do confirmar()).
  const troco = linhas.some((l) => l.forma === "dinheiro") ? Math.max(0, totalPago - total) : 0;

  function atualizarLinha(indice: number, alteracao: Partial<LinhaPagamento>) {
    setLinhas((atual) => atual.map((l, i) => (i === indice ? { ...l, ...alteracao } : l)));
  }

  function adicionarLinha() {
    const formaJaUsada = new Set(linhas.map((l) => l.forma));
    const proximaForma = FORMAS_PAGAMENTO.find((f) => !formaJaUsada.has(f.valor))?.valor ?? "dinheiro";
    setLinhas((atual) => [...atual, { forma: proximaForma, valor: saldoRestante > 0 ? saldoRestante.toFixed(2) : "0.00" }]);
  }

  function removerLinha(indice: number) {
    setLinhas((atual) => atual.filter((_, i) => i !== indice));
  }

  async function confirmar() {
    if (totalPago + 0.01 < total) {
      setErro("O total pago é menor que o total da venda.");
      return;
    }

    setEnviando(true);
    setErro(null);

    const pagamentos: Pagamento[] = linhas
      .filter((l) => (Number(l.valor) || 0) > 0)
      .map((l) => ({ forma_pagamento: l.forma, valor: Number(l.valor) || 0 }));

    try {
      await onConfirmar(pagamentos, emitirNotaFiscal);
    } catch {
      setErro("Não foi possível concluir a venda. Tente novamente.");
      setEnviando(false);
    }
  }

  // Atalhos idênticos à tela de referência: letra de cada forma de
  // pagamento afeta a primeira linha (a principal), F6-Troco, Esc-fecha.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onFechar();
        return;
      }
      if (event.key === "F6") {
        event.preventDefault();
        atualizarLinha(0, { forma: "dinheiro" });
        return;
      }

      const opcao = FORMAS_PAGAMENTO.find((f) => f.tecla.toLowerCase() === event.key.toLowerCase());
      if (opcao && !event.ctrlKey && !event.metaKey) {
        atualizarLinha(0, { forma: opcao.valor });
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-md rounded-lg border border-slate-300 bg-slate-50 p-6 shadow-2xl">
        <div className="mb-1 flex items-center justify-between text-sm text-slate-500">
          <span className="flex items-center gap-1">
            <UserRound className="h-3.5 w-3.5" />
            F10 - Cliente: {clienteNome}
          </span>
          <span>F9 - Opções</span>
        </div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900">Finalizar Caixa</h2>
          <span className="text-2xl font-bold text-slate-900">R$ {total.toFixed(2)}</span>
        </div>

        <p className="mb-2 text-sm text-slate-500">Formas de pagamento ({linhas.length}):</p>
        <div className="mb-4 grid grid-cols-3 gap-2">
          {FORMAS_PAGAMENTO.map((opcao) => {
            const Icone = ICONES_FORMA_PAGAMENTO[opcao.valor];
            return (
              <button
                key={opcao.valor}
                onClick={() => atualizarLinha(0, { forma: opcao.valor })}
                className={`flex items-center gap-1.5 rounded border px-3 py-2 text-sm ${
                  linhas[0].forma === opcao.valor
                    ? "border-blue-500 bg-blue-600 text-white"
                    : "border-slate-300 bg-white text-slate-600 hover:bg-slate-100"
                }`}
              >
                <Icone className="h-4 w-4" />
                {opcao.tecla} - {opcao.rotulo}
              </button>
            );
          })}
        </div>

        <label className="mb-1 block text-sm text-slate-500">
          {linhas.length > 1 ? "Valor nesta forma R$" : "Total pago R$"}
        </label>
        <input
          type="number"
          step="0.01"
          autoFocus
          value={linhas[0].valor}
          onChange={(e) => atualizarLinha(0, { valor: e.target.value })}
          onKeyDown={(e) => e.key === "Enter" && confirmar()}
          className="mb-2 w-full rounded border border-slate-300 bg-white px-3 py-2 text-xl text-slate-900 outline-none focus:border-blue-500"
        />

        {linhas.length > 1 && (
          <div className="mb-2 space-y-2">
            {linhas.slice(1).map((linha, i) => {
              const indice = i + 1;
              return (
                <div key={indice} className="flex items-center gap-2">
                  <select
                    value={linha.forma}
                    onChange={(e) => atualizarLinha(indice, { forma: e.target.value as FormaPagamento })}
                    className="rounded border border-slate-300 bg-white px-2 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
                  >
                    {FORMAS_PAGAMENTO.map((opcao) => (
                      <option key={opcao.valor} value={opcao.valor}>
                        {opcao.rotulo}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    step="0.01"
                    value={linha.valor}
                    onChange={(e) => atualizarLinha(indice, { valor: e.target.value })}
                    onKeyDown={(e) => e.key === "Enter" && confirmar()}
                    className="flex-1 rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => removerLinha(indice)}
                    className="rounded border border-slate-300 p-2 text-slate-500 hover:bg-slate-100"
                    aria-label="Remover forma de pagamento"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <button
          type="button"
          onClick={adicionarLinha}
          className="mb-4 flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700"
        >
          <Plus className="h-4 w-4" />
          Adicionar forma de pagamento
        </button>

        {saldoRestante > 0 ? (
          <p className="mb-4 flex items-center gap-1.5 text-lg text-amber-600">
            <AlertCircle className="h-5 w-5" />
            Falta: R$ {saldoRestante.toFixed(2)}
          </p>
        ) : (
          <p className="mb-4 flex items-center gap-1.5 text-lg text-emerald-600">
            <CircleDollarSign className="h-5 w-5" />
            F6 - Troco: {troco > 0 ? `R$ ${troco.toFixed(2)}` : "—"}
          </p>
        )}

        {possuiEmissaoFiscalConfigurada && (
          <div className="mb-4">
            <label className="mb-1 block text-sm text-slate-500">Emitir nota fiscal (NFC-e)?</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setEmitirNotaFiscal(true)}
                className={`rounded border px-3 py-2 text-sm ${
                  emitirNotaFiscal
                    ? "border-blue-500 bg-blue-600 text-white"
                    : "border-slate-300 bg-white text-slate-600 hover:bg-slate-100"
                }`}
              >
                Sim
              </button>
              <button
                type="button"
                onClick={() => setEmitirNotaFiscal(false)}
                className={`rounded border px-3 py-2 text-sm ${
                  !emitirNotaFiscal
                    ? "border-blue-500 bg-blue-600 text-white"
                    : "border-slate-300 bg-white text-slate-600 hover:bg-slate-100"
                }`}
              >
                Não
              </button>
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
            onClick={onFechar}
            disabled={enviando}
            className="flex items-center gap-1.5 rounded border border-slate-300 px-4 py-2 text-slate-600 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
            Esc - Cancelar
          </button>
          <button
            onClick={confirmar}
            disabled={enviando}
            className="flex items-center gap-2 rounded bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
          >
            <CheckCircle2 className="h-4 w-4" />
            {enviando ? "Finalizando..." : "Finalizar Caixa"}
          </button>
        </div>
      </div>
    </div>
  );
}
