"use client";

import { AlertCircle, ArrowRightLeft, CheckCircle2, Plus, Truck } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "@/lib/apiClient";
import type { StatusTransferencia, TransferenciaEstoque } from "@/lib/types";

type PaginaTransferencias = {
  data: TransferenciaEstoque[];
  current_page: number;
  last_page: number;
};

const ABAS: { valor: StatusTransferencia | ""; rotulo: string }[] = [
  { valor: "", rotulo: "Todas" },
  { valor: "rascunho", rotulo: "Nova" },
  { valor: "em_transito", rotulo: "Em andamento" },
  { valor: "recebida", rotulo: "Recebidas" },
  { valor: "cancelada", rotulo: "Canceladas" },
];

function corStatus(status: StatusTransferencia): string {
  if (status === "recebida") return "bg-emerald-100 text-emerald-700";
  if (status === "em_transito") return "bg-blue-100 text-blue-700";
  if (status === "cancelada") return "bg-slate-200 text-slate-600";
  return "bg-amber-100 text-amber-700";
}

function rotuloStatus(status: StatusTransferencia): string {
  if (status === "rascunho") return "Nova";
  if (status === "em_transito") return "Em andamento";
  if (status === "recebida") return "Recebida";
  return "Cancelada";
}

export default function TransferenciasPage() {
  const [aba, setAba] = useState<StatusTransferencia | "">("");
  const [pagina, setPagina] = useState(1);
  const [dados, setDados] = useState<PaginaTransferencias | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [processandoId, setProcessandoId] = useState<number | null>(null);

  async function carregar() {
    setErro(null);
    const query = new URLSearchParams({ page: String(pagina) });
    if (aba) query.set("status", aba);
    try {
      setDados(await apiFetch<PaginaTransferencias>(`transferencias-estoque?${query.toString()}`));
    } catch {
      setErro("Não foi possível carregar as transferências.");
    }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aba, pagina]);

  async function receber(transferencia: TransferenciaEstoque) {
    if (!window.confirm(`Confirmar recebimento da transferência #${transferencia.id}? Isso vai somar os itens no estoque da loja de destino.`)) {
      return;
    }
    setProcessandoId(transferencia.id);
    try {
      await apiFetch(`transferencias-estoque/${transferencia.id}/receber`, { method: "POST" });
      await carregar();
    } catch (e) {
      window.alert(e instanceof ApiError ? e.message : "Não foi possível confirmar o recebimento.");
    } finally {
      setProcessandoId(null);
    }
  }

  return (
    <div className="text-slate-900">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Truck className="h-5 w-5 text-blue-600" />
          Logística — Transferências entre lojas
        </h2>
        <Link
          href="/admin/transferencias/nova"
          className="flex items-center gap-1.5 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
        >
          <Plus className="h-4 w-4" />
          Nova transferência
        </Link>
      </div>

      <div className="mb-4 flex gap-1 border-b border-slate-200">
        {ABAS.map((item) => (
          <button
            key={item.valor}
            onClick={() => {
              setPagina(1);
              setAba(item.valor);
            }}
            className={`px-3 py-2 text-sm font-medium ${
              aba === item.valor
                ? "border-b-2 border-blue-600 text-blue-600"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {item.rotulo}
          </button>
        ))}
      </div>

      {erro && (
        <p className="mb-4 flex items-center gap-1.5 text-sm text-red-600">
          <AlertCircle className="h-4 w-4" />
          {erro}
        </p>
      )}

      <div className="overflow-auto rounded border border-slate-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr className="divide-x divide-slate-200">
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2">Data</th>
              <th className="px-3 py-2">Origem</th>
              <th className="px-3 py-2">Destino</th>
              <th className="px-3 py-2">Itens</th>
              <th className="px-3 py-2">Nota fiscal</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {!dados && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-slate-500">
                  Carregando...
                </td>
              </tr>
            )}
            {dados?.data.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-slate-500">
                  Nenhuma transferência encontrada.
                </td>
              </tr>
            )}
            {dados?.data.map((t) => (
              <tr key={t.id} className="divide-x divide-slate-200 border-t border-slate-200">
                <td className="px-3 py-2">
                  <Link href={`/admin/transferencias/${t.id}`} className="text-blue-600 hover:underline">
                    #{t.id}
                  </Link>
                </td>
                <td className="px-3 py-2 whitespace-nowrap">{new Date(t.created_at).toLocaleString("pt-BR")}</td>
                <td className="px-3 py-2 flex items-center gap-1.5">
                  {t.loja_origem?.nome ?? "—"}
                </td>
                <td className="px-3 py-2">
                  <span className="inline-flex items-center gap-1">
                    <ArrowRightLeft className="h-3.5 w-3.5 text-slate-400" />
                    {t.loja_destino?.nome ?? "—"}
                  </span>
                </td>
                <td className="px-3 py-2">{t.itens_count ?? t.itens?.length ?? "—"}</td>
                <td className="px-3 py-2">
                  {t.nota_fiscal ? (
                    <span
                      title={t.nota_fiscal.status === "rejected" ? (t.nota_fiscal.mensagem_retorno ?? undefined) : undefined}
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        t.nota_fiscal.status === "authorized"
                          ? "bg-emerald-100 text-emerald-700"
                          : t.nota_fiscal.status === "rejected"
                            ? "bg-red-100 text-red-700"
                            : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {t.nota_fiscal.status === "authorized"
                        ? "Autorizada"
                        : t.nota_fiscal.status === "rejected"
                          ? "Rejeitada"
                          : t.nota_fiscal.status}
                    </span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${corStatus(t.status)}`}>
                    {rotuloStatus(t.status)}
                  </span>
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {t.status === "em_transito" && (
                    <button
                      onClick={() => receber(t)}
                      disabled={processandoId === t.id}
                      className="flex items-center gap-1 text-xs font-medium text-emerald-600 hover:underline disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {processandoId === t.id ? "Confirmando..." : "Confirmar recebimento"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {dados && dados.last_page > 1 && (
        <div className="mt-3 flex items-center justify-between text-sm text-slate-600">
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
