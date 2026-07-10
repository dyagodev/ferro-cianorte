"use client";

import {
  Banknote,
  CircleDollarSign,
  ClipboardList,
  LayoutDashboard,
  ListChecks,
  Menu as MenuIcon,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/apiClient";
import type { FormaPagamento } from "@/lib/types";

type Fechamento = {
  por_forma_pagamento: { forma_pagamento: FormaPagamento; total: string }[];
  total_geral: number;
  sangrias: { id: number; valor: string; observacao: string | null; created_at: string }[];
  total_sangrias: number;
  dinheiro_esperado_em_caixa: number;
};

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

type Aba = "menu" | "sangria" | "fechamento";

export default function MenuModal({
  role,
  lojaId,
  onFechar,
}: {
  role: "admin" | "vendedor";
  lojaId: number | null;
  onFechar: () => void;
}) {
  const [aba, setAba] = useState<Aba>("menu");

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onFechar();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onFechar]);

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-md rounded-lg border border-slate-300 bg-slate-50 p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-xl font-semibold text-slate-900">
            <MenuIcon className="h-5 w-5 text-blue-600" />
            {aba === "menu" ? "Ctrl+M - Menu" : aba === "sangria" ? "Sangria" : "Fechamento de Caixa"}
          </h2>
          <button
            onClick={aba === "menu" ? onFechar : () => setAba("menu")}
            className="flex items-center gap-1 text-slate-500 hover:text-slate-900"
          >
            <X className="h-4 w-4" />
            {aba === "menu" ? "Esc - Fechar" : "Voltar"}
          </button>
        </div>

        {aba === "menu" && (
          <div className="flex flex-col gap-2">
            <button
              onClick={() => setAba("sangria")}
              className="flex items-center gap-2 rounded border border-slate-300 bg-white px-4 py-3 text-left text-slate-900 hover:bg-slate-100"
            >
              <Banknote className="h-5 w-5 text-amber-600" />
              Sangria
            </button>
            <button
              onClick={() => setAba("fechamento")}
              className="flex items-center gap-2 rounded border border-slate-300 bg-white px-4 py-3 text-left text-slate-900 hover:bg-slate-100"
            >
              <ClipboardList className="h-5 w-5 text-emerald-600" />
              Fechamento de Caixa
            </button>
            {role === "admin" && (
              <a
                href="/admin"
                className="flex items-center gap-2 rounded border border-slate-300 bg-white px-4 py-3 text-left text-slate-900 hover:bg-slate-100"
              >
                <LayoutDashboard className="h-5 w-5 text-blue-600" />
                Área Administrativa
              </a>
            )}
          </div>
        )}

        {aba === "sangria" && <FormularioSangria lojaId={lojaId} onConcluido={() => setAba("menu")} />}
        {aba === "fechamento" && <ResumoFechamento lojaId={lojaId} />}
      </div>
    </div>
  );
}

function FormularioSangria({ lojaId, onConcluido }: { lojaId: number | null; onConcluido: () => void }) {
  const [valor, setValor] = useState("");
  const [observacao, setObservacao] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [concluida, setConcluida] = useState(false);

  async function confirmar(event: React.FormEvent) {
    event.preventDefault();
    setEnviando(true);
    setErro(null);

    try {
      await apiFetch("caixa/sangrias", {
        method: "POST",
        body: JSON.stringify({ loja_id: lojaId, valor: Number(valor), observacao: observacao || null }),
      });
      setConcluida(true);
      setTimeout(onConcluido, 1200);
    } catch {
      setErro("Não foi possível registrar a sangria.");
    } finally {
      setEnviando(false);
    }
  }

  if (concluida) {
    return (
      <div className="flex flex-col items-center gap-2 py-6 text-emerald-600">
        <Banknote className="h-8 w-8" />
        <p className="font-medium">Sangria registrada!</p>
      </div>
    );
  }

  return (
    <form onSubmit={confirmar}>
      <label className="mb-1 block text-sm text-slate-500">Valor retirado R$</label>
      <input
        type="number"
        step="0.01"
        min="0.01"
        autoFocus
        required
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        className="mb-3 w-full rounded border border-slate-300 bg-white px-3 py-2 text-xl text-slate-900 outline-none focus:border-blue-500"
      />

      <label className="mb-1 block text-sm text-slate-500">Observação (opcional)</label>
      <input
        value={observacao}
        onChange={(e) => setObservacao(e.target.value)}
        placeholder="Ex.: depósito no banco"
        className="mb-4 w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
      />

      {erro && <p className="mb-4 text-sm text-red-600">{erro}</p>}

      <button
        type="submit"
        disabled={enviando}
        className="flex w-full items-center justify-center gap-2 rounded bg-amber-600 px-4 py-2 font-medium text-white hover:bg-amber-500 disabled:opacity-60"
      >
        <Banknote className="h-4 w-4" />
        {enviando ? "Registrando..." : "Confirmar sangria"}
      </button>
    </form>
  );
}

function ResumoFechamento({ lojaId }: { lojaId: number | null }) {
  const [dados, setDados] = useState<Fechamento | null>(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    const query = lojaId ? `?loja_id=${lojaId}` : "";
    apiFetch<Fechamento>(`caixa/fechamento${query}`)
      .then(setDados)
      .catch(() => setErro(true));
  }, [lojaId]);

  if (erro) return <p className="text-red-600">Não foi possível carregar o fechamento de caixa.</p>;
  if (!dados) return <p className="text-slate-500">Carregando...</p>;

  return (
    <div>
      <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-slate-600">
        <ListChecks className="h-4 w-4" />
        Recebido hoje por forma de pagamento
      </p>
      <ul className="mb-4 divide-y divide-slate-200 rounded border border-slate-200">
        {dados.por_forma_pagamento.map((item) => (
          <li key={item.forma_pagamento} className="flex justify-between px-3 py-2 text-sm text-slate-900">
            <span>{ROTULO_FORMA[item.forma_pagamento]}</span>
            <span>R$ {Number(item.total).toFixed(2)}</span>
          </li>
        ))}
        {dados.por_forma_pagamento.length === 0 && (
          <li className="px-3 py-4 text-center text-sm text-slate-500">Nenhuma venda hoje ainda.</li>
        )}
      </ul>

      <div className="mb-4 flex justify-between rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900">
        <span>Total recebido hoje</span>
        <span className="font-semibold">R$ {dados.total_geral.toFixed(2)}</span>
      </div>

      {dados.sangrias.length > 0 && (
        <>
          <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-slate-600">
            <Banknote className="h-4 w-4" />
            Sangrias de hoje
          </p>
          <ul className="mb-4 divide-y divide-slate-200 rounded border border-slate-200">
            {dados.sangrias.map((sangria) => (
              <li key={sangria.id} className="flex justify-between px-3 py-2 text-sm text-slate-900">
                <span>{sangria.observacao ?? "Sem observação"}</span>
                <span>R$ {Number(sangria.valor).toFixed(2)}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="flex items-center justify-between rounded border border-emerald-300 bg-emerald-50 px-3 py-3 text-emerald-700">
        <span className="flex items-center gap-1.5 font-medium">
          <CircleDollarSign className="h-4 w-4" />
          Dinheiro esperado em caixa
        </span>
        <span className="text-lg font-semibold">R$ {dados.dinheiro_esperado_em_caixa.toFixed(2)}</span>
      </div>
    </div>
  );
}
