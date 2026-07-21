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
  QrCode,
  UserRound,
  type LucideIcon,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { FORMAS_PAGAMENTO, type FormaPagamento } from "@/lib/types";

type Pagamento = { forma_pagamento: FormaPagamento; valor: number };

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
  possuiSpedyConfigurado,
  onFechar,
  onConfirmar,
}: {
  total: number;
  clienteNome: string;
  possuiSpedyConfigurado: boolean;
  onFechar: () => void;
  onConfirmar: (pagamentos: Pagamento[], emitirNotaFiscal: boolean) => Promise<void>;
}) {
  const [forma, setForma] = useState<FormaPagamento>("dinheiro");
  const [valorPago, setValorPago] = useState(total.toFixed(2));
  const [emitirNotaFiscal, setEmitirNotaFiscal] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const troco = useMemo(() => {
    const pago = Number(valorPago) || 0;
    return forma === "dinheiro" ? Math.max(0, pago - total) : 0;
  }, [valorPago, total, forma]);

  async function confirmar() {
    setEnviando(true);
    setErro(null);

    try {
      await onConfirmar([{ forma_pagamento: forma, valor: Number(valorPago) || total }], emitirNotaFiscal);
    } catch {
      setErro("Não foi possível concluir a venda. Tente novamente.");
      setEnviando(false);
    }
  }

  // Atalhos idênticos à tela de referência: letra de cada forma de pagamento, F6-Troco, Esc-fecha.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onFechar();
        return;
      }
      if (event.key === "F6") {
        event.preventDefault();
        setForma("dinheiro");
        return;
      }

      const opcao = FORMAS_PAGAMENTO.find((f) => f.tecla.toLowerCase() === event.key.toLowerCase());
      if (opcao && !event.ctrlKey && !event.metaKey) {
        setForma(opcao.valor);
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

        <p className="mb-2 text-sm text-slate-500">Formas de pagamento (1):</p>
        <div className="mb-4 grid grid-cols-3 gap-2">
          {FORMAS_PAGAMENTO.map((opcao) => {
            const Icone = ICONES_FORMA_PAGAMENTO[opcao.valor];
            return (
              <button
                key={opcao.valor}
                onClick={() => setForma(opcao.valor)}
                className={`flex items-center gap-1.5 rounded border px-3 py-2 text-sm ${
                  forma === opcao.valor
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

        <label className="mb-1 block text-sm text-slate-500">Total pago R$</label>
        <input
          type="number"
          step="0.01"
          autoFocus
          value={valorPago}
          onChange={(e) => setValorPago(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && confirmar()}
          className="mb-4 w-full rounded border border-slate-300 bg-white px-3 py-2 text-xl text-slate-900 outline-none focus:border-blue-500"
        />

        <p className="mb-4 flex items-center gap-1.5 text-lg text-emerald-600">
          <CircleDollarSign className="h-5 w-5" />
          F6 - Troco: {forma === "dinheiro" ? `R$ ${troco.toFixed(2)}` : "—"}
        </p>

        {possuiSpedyConfigurado && (
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
