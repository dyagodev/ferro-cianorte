"use client";

import { AlertCircle, ArrowLeft, ArrowRightLeft, CheckCircle2, FileText, Truck } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "@/lib/apiClient";
import type { StatusTransferencia, TransferenciaEstoque } from "@/lib/types";

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

export default function DetalheTransferenciaPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [transferencia, setTransferencia] = useState<TransferenciaEstoque | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [processando, setProcessando] = useState(false);

  async function carregar() {
    try {
      setTransferencia(await apiFetch<TransferenciaEstoque>(`transferencias-estoque/${params.id}`));
    } catch {
      setErro("Não foi possível carregar essa transferência.");
    }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function receber() {
    if (!transferencia) return;
    if (!window.confirm("Confirmar recebimento? Isso vai somar os itens no estoque da loja de destino.")) return;
    setProcessando(true);
    try {
      await apiFetch(`transferencias-estoque/${transferencia.id}/receber`, { method: "POST" });
      await carregar();
    } catch (e) {
      window.alert(e instanceof ApiError ? e.message : "Não foi possível confirmar o recebimento.");
    } finally {
      setProcessando(false);
    }
  }

  async function cancelar() {
    if (!transferencia) return;
    const emTransito = transferencia.status === "em_transito";
    const temNotaAutorizada = transferencia.nota_fiscal?.status === "authorized";
    let justificativa: string | null = null;

    if (temNotaAutorizada) {
      justificativa = window.prompt("Justificativa do cancelamento da NF-e (mín. 15 caracteres, exigido pela SEFAZ):");
      if (!justificativa) return;
      if (justificativa.trim().length < 15) {
        window.alert("A justificativa precisa ter pelo menos 15 caracteres.");
        return;
      }
    }

    if (!window.confirm("Confirma o cancelamento dessa transferência?" + (emTransito ? " Isso estorna o estoque da origem" + (temNotaAutorizada ? " e cancela a NF-e na SEFAZ." : ".") : ""))) {
      return;
    }

    setProcessando(true);
    try {
      await apiFetch(`transferencias-estoque/${transferencia.id}/cancelar`, {
        method: "POST",
        body: JSON.stringify({ justificativa }),
      });
      await carregar();
    } catch (e) {
      window.alert(e instanceof ApiError ? e.message : "Não foi possível cancelar a transferência.");
    } finally {
      setProcessando(false);
    }
  }

  async function emitir() {
    if (!transferencia) return;
    setProcessando(true);
    try {
      await apiFetch(`transferencias-estoque/${transferencia.id}/emitir`, { method: "POST" });
      await carregar();
    } catch (e) {
      window.alert(e instanceof ApiError ? e.message : "Não foi possível emitir a NF-e.");
      await carregar();
    } finally {
      setProcessando(false);
    }
  }

  async function confirmarSemNota() {
    if (!transferencia) return;
    if (!window.confirm("Confirmar transferência SEM nota fiscal? A origem já baixa o estoque na hora.")) return;
    setProcessando(true);
    try {
      await apiFetch(`transferencias-estoque/${transferencia.id}/confirmar-sem-nota`, { method: "POST" });
      await carregar();
    } catch (e) {
      window.alert(e instanceof ApiError ? e.message : "Não foi possível confirmar a transferência.");
    } finally {
      setProcessando(false);
    }
  }

  if (erro) {
    return (
      <p className="flex items-center gap-1.5 text-sm text-red-600">
        <AlertCircle className="h-4 w-4" />
        {erro}
      </p>
    );
  }

  if (!transferencia) {
    return <p className="text-slate-500">Carregando...</p>;
  }

  const total = (transferencia.itens ?? []).reduce(
    (soma, item) => soma + Number(item.quantidade) * Number(item.preco_unitario),
    0,
  );

  return (
    <div className="max-w-3xl text-slate-900">
      <button
        onClick={() => router.push("/admin/transferencias")}
        className="mb-4 flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar pra logística
      </button>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Truck className="h-5 w-5 text-blue-600" />
          Transferência #{transferencia.id}
        </h2>
        <span className={`rounded-full px-2 py-1 text-xs font-medium ${corStatus(transferencia.status)}`}>
          {rotuloStatus(transferencia.status)}
        </span>
      </div>

      <div className="mb-4 flex items-center gap-3 rounded border border-slate-200 bg-slate-50 p-4 text-sm">
        <span className="font-medium">{transferencia.loja_origem?.nome ?? "—"}</span>
        <ArrowRightLeft className="h-4 w-4 text-slate-400" />
        <span className="font-medium">{transferencia.loja_destino?.nome ?? "—"}</span>
      </div>

      {transferencia.observacao && (
        <p className="mb-4 text-sm text-slate-600">
          <span className="text-slate-400">Observação: </span>
          {transferencia.observacao}
        </p>
      )}

      <div className="mb-4 overflow-auto rounded border border-slate-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr className="divide-x divide-slate-200">
              <th className="px-3 py-2">Produto</th>
              <th className="px-3 py-2">Qtd</th>
              <th className="px-3 py-2">Preço unit.</th>
              <th className="px-3 py-2">Total</th>
            </tr>
          </thead>
          <tbody>
            {(transferencia.itens ?? []).map((item) => (
              <tr key={item.id} className="divide-x divide-slate-200 border-t border-slate-200">
                <td className="px-3 py-2">{item.produto?.descricao ?? `#${item.produto_id}`}</td>
                <td className="px-3 py-2">{item.quantidade}</td>
                <td className="px-3 py-2">R$ {Number(item.preco_unitario).toFixed(2)}</td>
                <td className="px-3 py-2">R$ {(Number(item.quantidade) * Number(item.preco_unitario)).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mb-4 flex items-center justify-between rounded border border-slate-200 bg-slate-50 p-4">
        <span className="text-sm text-slate-500">Total</span>
        <span className="text-xl font-bold">R$ {total.toFixed(2)}</span>
      </div>

      <div className="mb-4 rounded border border-slate-200 bg-slate-50 p-3">
        <p className="mb-2 text-sm font-medium text-slate-600">Nota fiscal</p>
        {!transferencia.nota_fiscal ? (
          <p className="text-sm text-slate-400">Ainda não emitida.</p>
        ) : (
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-600">NF-e</span>
            <span className="flex items-center gap-2">
              {transferencia.nota_fiscal.status === "authorized" && (
                <>
                  <a
                    href={`/api/proxy/notas-fiscais/${transferencia.nota_fiscal.id}/danfe`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Baixar DANFE
                  </a>
                  <a
                    href={`/api/proxy/notas-fiscais/${transferencia.nota_fiscal.id}/xml`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Baixar XML
                  </a>
                </>
              )}
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  transferencia.nota_fiscal.status === "authorized"
                    ? "bg-emerald-100 text-emerald-700"
                    : transferencia.nota_fiscal.status === "rejected"
                      ? "bg-red-100 text-red-700"
                      : "bg-slate-200 text-slate-600"
                }`}
              >
                {transferencia.nota_fiscal.status === "authorized"
                  ? "Autorizada"
                  : transferencia.nota_fiscal.status === "rejected"
                    ? "Rejeitada"
                    : transferencia.nota_fiscal.status}
              </span>
            </span>
          </div>
        )}
        {transferencia.nota_fiscal?.mensagem_retorno && transferencia.nota_fiscal.status !== "authorized" && (
          <p className="mt-2 text-xs text-red-600">{transferencia.nota_fiscal.mensagem_retorno}</p>
        )}
      </div>

      {transferencia.status === "em_transito" && !transferencia.manifesto_transporte_id && (
        <div className="mb-4">
          <Link
            href={`/admin/manifestos-transporte?transferencia_id=${transferencia.id}`}
            className="flex items-center gap-1.5 text-sm text-blue-600 hover:underline"
          >
            <Truck className="h-4 w-4" />
            Gerar MDF-e pra essa transferência
          </Link>
        </div>
      )}

      <div className="flex gap-2">
        {transferencia.status === "rascunho" && (
          <>
            <button
              onClick={emitir}
              disabled={processando}
              className="flex items-center gap-1.5 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
            >
              <FileText className="h-4 w-4" />
              Emitir documentos
            </button>
            <button
              onClick={confirmarSemNota}
              disabled={processando}
              className="rounded border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
            >
              Confirmar sem nota fiscal
            </button>
          </>
        )}
        {transferencia.status === "em_transito" && (
          <button
            onClick={receber}
            disabled={processando}
            className="flex items-center gap-1.5 rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            <CheckCircle2 className="h-4 w-4" />
            Confirmar recebimento
          </button>
        )}
        {(transferencia.status === "rascunho" || transferencia.status === "em_transito") && (
          <button
            onClick={cancelar}
            disabled={processando}
            className="rounded border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            Cancelar transferência
          </button>
        )}
      </div>
    </div>
  );
}
