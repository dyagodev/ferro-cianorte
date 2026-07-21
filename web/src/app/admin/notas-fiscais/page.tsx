"use client";

import { AlertCircle, FileCheck2, Plus } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "@/lib/apiClient";
import type { Loja, NotaFiscal } from "@/lib/types";

type NotaFiscalComVenda = NotaFiscal & {
  venda_id: number;
  created_at: string;
  venda: {
    id: number;
    total: string;
    status: string;
    loja: { id: number; nome: string } | null;
    cliente: { id: number; nome: string } | null;
  } | null;
};

type PaginaNotas = {
  data: NotaFiscalComVenda[];
  current_page: number;
  last_page: number;
};

const ROTULO_TIPO: Record<string, string> = { nfce: "NFC-e", nfe: "NF-e", nfse: "NFS-e" };

const ROTULO_STATUS: Record<string, string> = {
  authorized: "Autorizada",
  rejected: "Rejeitada",
  canceled: "Cancelada",
  created: "Criada",
  enqueued: "Enfileirada",
};

function corStatus(status: string): string {
  if (status === "authorized") return "bg-emerald-100 text-emerald-700";
  if (status === "rejected") return "bg-red-100 text-red-700";
  if (status === "canceled") return "bg-slate-200 text-slate-600";
  return "bg-amber-100 text-amber-700";
}

export default function NotasFiscaisPage() {
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [lojaId, setLojaId] = useState("");
  const [tipo, setTipo] = useState("");
  const [status, setStatus] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [pagina, setPagina] = useState(1);

  const [dados, setDados] = useState<PaginaNotas | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [cancelandoId, setCancelandoId] = useState<number | null>(null);

  useEffect(() => {
    apiFetch<Loja[]>("lojas").then(setLojas);
  }, []);

  async function carregar() {
    setErro(null);
    const query = new URLSearchParams({ page: String(pagina) });
    if (lojaId) query.set("loja_id", lojaId);
    if (tipo) query.set("tipo", tipo);
    if (status) query.set("status", status);
    if (dataInicio) query.set("data_inicio", dataInicio);
    if (dataFim) query.set("data_fim", dataFim);

    try {
      setDados(await apiFetch<PaginaNotas>(`notas-fiscais?${query.toString()}`));
    } catch {
      setErro("Não foi possível carregar as notas fiscais.");
    }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagina, lojaId, tipo, status, dataInicio, dataFim]);

  async function cancelar(nota: NotaFiscalComVenda) {
    const justificativa = window.prompt(
      "Justificativa do cancelamento (mín. 15 caracteres, exigido pela SEFAZ):",
    );
    if (!justificativa) return;
    if (justificativa.trim().length < 15) {
      window.alert("A justificativa precisa ter pelo menos 15 caracteres.");
      return;
    }
    if (!window.confirm("Confirma o cancelamento dessa nota na SEFAZ? Essa ação não pode ser desfeita.")) {
      return;
    }

    setCancelandoId(nota.id);
    try {
      await apiFetch(`notas-fiscais/${nota.id}/cancelar`, {
        method: "POST",
        body: JSON.stringify({ justificativa: justificativa.trim() }),
      });
      await carregar();
    } catch (e) {
      window.alert(e instanceof ApiError ? e.message : "Não foi possível cancelar a nota fiscal.");
    } finally {
      setCancelandoId(null);
    }
  }

  return (
    <div className="text-slate-900">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <FileCheck2 className="h-5 w-5 text-blue-600" />
          Notas Fiscais
        </h2>
        <Link
          href="/admin/nfe"
          className="flex items-center gap-1.5 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
        >
          <Plus className="h-4 w-4" />
          Emitir NF-e
        </Link>
      </div>

      <p className="mb-4 text-sm text-slate-500">
        Todas as notas emitidas (NFC-e, NF-e, NFS-e), sem precisar caçar venda por venda.
      </p>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div>
          <label className="mb-1 block text-xs text-slate-500">Loja</label>
          <select
            value={lojaId}
            onChange={(e) => {
              setPagina(1);
              setLojaId(e.target.value);
            }}
            className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
          >
            <option value="">Todas</option>
            {lojas.map((loja) => (
              <option key={loja.id} value={loja.id}>
                {loja.nome}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">Tipo</label>
          <select
            value={tipo}
            onChange={(e) => {
              setPagina(1);
              setTipo(e.target.value);
            }}
            className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
          >
            <option value="">Todos</option>
            <option value="nfce">NFC-e</option>
            <option value="nfe">NF-e</option>
            <option value="nfse">NFS-e</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">Status</label>
          <select
            value={status}
            onChange={(e) => {
              setPagina(1);
              setStatus(e.target.value);
            }}
            className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
          >
            <option value="">Todos</option>
            <option value="authorized">Autorizada</option>
            <option value="rejected">Rejeitada</option>
            <option value="canceled">Cancelada</option>
            <option value="created">Criada</option>
            <option value="enqueued">Enfileirada</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">De</label>
          <input
            type="date"
            value={dataInicio}
            onChange={(e) => {
              setPagina(1);
              setDataInicio(e.target.value);
            }}
            className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">Até</label>
          <input
            type="date"
            value={dataFim}
            onChange={(e) => {
              setPagina(1);
              setDataFim(e.target.value);
            }}
            className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
          />
        </div>
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
              <th className="px-3 py-2">Venda</th>
              <th className="px-3 py-2">Data</th>
              <th className="px-3 py-2">Tipo</th>
              <th className="px-3 py-2">Loja</th>
              <th className="px-3 py-2">Cliente</th>
              <th className="px-3 py-2">Total</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Mensagem</th>
              <th className="px-3 py-2" />
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
            {dados?.data.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-slate-500">
                  Nenhuma nota fiscal encontrada.
                </td>
              </tr>
            )}
            {dados?.data.map((nota) => (
              <tr key={nota.id} className="divide-x divide-slate-200 border-t border-slate-200">
                <td className="px-3 py-2">#{nota.venda_id}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {new Date(nota.created_at).toLocaleString("pt-BR")}
                </td>
                <td className="px-3 py-2">{ROTULO_TIPO[nota.tipo] ?? nota.tipo}</td>
                <td className="px-3 py-2">{nota.venda?.loja?.nome ?? "—"}</td>
                <td className="px-3 py-2">{nota.venda?.cliente?.nome ?? "—"}</td>
                <td className="px-3 py-2">
                  {nota.venda ? `R$ ${Number(nota.venda.total).toFixed(2)}` : "—"}
                </td>
                <td className="px-3 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${corStatus(nota.status)}`}>
                    {ROTULO_STATUS[nota.status] ?? nota.status}
                  </span>
                </td>
                <td className="px-3 py-2 max-w-xs truncate text-slate-500" title={nota.mensagem_retorno ?? undefined}>
                  {nota.mensagem_retorno ?? "—"}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <div className="flex items-center gap-2 text-xs">
                    {(nota.tipo === "nfce" || nota.tipo === "nfe") && nota.status === "authorized" && (
                      <>
                        <a
                          href={`/api/proxy/notas-fiscais/${nota.id}/danfe`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          DANFE
                        </a>
                        <a
                          href={`/api/proxy/notas-fiscais/${nota.id}/xml`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          XML
                        </a>
                        <button
                          onClick={() => cancelar(nota)}
                          disabled={cancelandoId === nota.id}
                          className="text-red-600 hover:underline disabled:opacity-50"
                        >
                          {cancelandoId === nota.id ? "Cancelando..." : "Cancelar"}
                        </button>
                      </>
                    )}
                  </div>
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
