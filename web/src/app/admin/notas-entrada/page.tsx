"use client";

import { AlertCircle, Inbox, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "@/lib/apiClient";
import type { Loja, NotaFiscalTerceiro } from "@/lib/types";

type PaginaNotasEntrada = {
  data: NotaFiscalTerceiro[];
  current_page: number;
  last_page: number;
};

const ROTULO_SITUACAO: Record<string, string> = {
  resumo: "Resumo (aguardando XML)",
  completa: "Completa",
};

function corSituacao(situacao: string): string {
  return situacao === "completa" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700";
}

export default function NotasEntradaPage() {
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [lojaId, setLojaId] = useState("");
  const [situacao, setSituacao] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [pagina, setPagina] = useState(1);

  const [dados, setDados] = useState<PaginaNotasEntrada | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [sincronizando, setSincronizando] = useState(false);
  const [lojaSincronizar, setLojaSincronizar] = useState("");

  useEffect(() => {
    apiFetch<Loja[]>("lojas").then((dados) => {
      setLojas(dados);
      setLojaSincronizar((atual) => atual || String(dados[0]?.id ?? ""));
    });
  }, []);

  async function carregar() {
    setErro(null);
    const query = new URLSearchParams({ page: String(pagina) });
    if (lojaId) query.set("loja_id", lojaId);
    if (situacao) query.set("situacao", situacao);
    if (dataInicio) query.set("data_inicio", dataInicio);
    if (dataFim) query.set("data_fim", dataFim);

    try {
      setDados(await apiFetch<PaginaNotasEntrada>(`notas-entrada?${query.toString()}`));
    } catch {
      setErro("Não foi possível carregar as notas de entrada.");
    }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagina, lojaId, situacao, dataInicio, dataFim]);

  async function sincronizar() {
    if (!lojaSincronizar) return;
    setSincronizando(true);
    setErro(null);
    try {
      const resumo = await apiFetch<{ novas: number; atualizadas: number; erros: number }>(
        "notas-entrada/sincronizar",
        { method: "POST", body: JSON.stringify({ loja_id: Number(lojaSincronizar) }) },
      );
      window.alert(
        `Sincronização concluída: ${resumo.novas} nova(s), ${resumo.atualizadas} atualizada(s)`
        + (resumo.erros > 0 ? `, ${resumo.erros} erro(s) — veja o log do servidor.` : "."),
      );
      setPagina(1);
      await carregar();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível sincronizar com a SEFAZ.");
    } finally {
      setSincronizando(false);
    }
  }

  return (
    <div className="text-slate-900">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Inbox className="h-5 w-5 text-blue-600" />
          Notas de Entrada
        </h2>
        <div className="flex items-center gap-2">
          <select
            value={lojaSincronizar}
            onChange={(e) => setLojaSincronizar(e.target.value)}
            className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
          >
            {lojas.map((loja) => (
              <option key={loja.id} value={loja.id}>
                {loja.nome}
              </option>
            ))}
          </select>
          <button
            onClick={sincronizar}
            disabled={sincronizando || !lojaSincronizar}
            className="flex items-center gap-1.5 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${sincronizando ? "animate-spin" : ""}`} />
            {sincronizando ? "Sincronizando..." : "Sincronizar agora"}
          </button>
        </div>
      </div>

      <p className="mb-4 text-sm text-slate-500">
        Notas fiscais que fornecedores emitiram contra o CNPJ da loja (consulta à SEFAZ) — abra uma nota
        completa pra casar os itens com o cadastro e dar entrada no estoque. Não inclui NFS-e (nota de
        serviço), que é municipal e não passa por essa consulta.
      </p>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
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
          <label className="mb-1 block text-xs text-slate-500">Situação</label>
          <select
            value={situacao}
            onChange={(e) => {
              setPagina(1);
              setSituacao(e.target.value);
            }}
            className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
          >
            <option value="">Todas</option>
            <option value="resumo">Resumo (aguardando XML)</option>
            <option value="completa">Completa</option>
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
              <th className="px-3 py-2">Data emissão</th>
              <th className="px-3 py-2">Loja</th>
              <th className="px-3 py-2">Fornecedor</th>
              <th className="px-3 py-2">Valor</th>
              <th className="px-3 py-2">Situação</th>
              <th className="px-3 py-2">Entrada de estoque</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {!dados && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-slate-500">
                  Carregando...
                </td>
              </tr>
            )}
            {dados?.data.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-slate-500">
                  Nenhuma nota de entrada encontrada. Use "Sincronizar agora" pra consultar a SEFAZ.
                </td>
              </tr>
            )}
            {dados?.data.map((nota) => (
              <tr key={nota.id} className="divide-x divide-slate-200 border-t border-slate-200">
                <td className="px-3 py-2 whitespace-nowrap">
                  {nota.data_emissao ? new Date(nota.data_emissao).toLocaleString("pt-BR") : "—"}
                </td>
                <td className="px-3 py-2">{nota.loja?.nome ?? "—"}</td>
                <td className="px-3 py-2">{nota.emitente_nome || nota.emitente_cnpj || "—"}</td>
                <td className="px-3 py-2">
                  {nota.valor_total ? `R$ ${Number(nota.valor_total).toFixed(2)}` : "—"}
                </td>
                <td className="px-3 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${corSituacao(nota.situacao)}`}>
                    {ROTULO_SITUACAO[nota.situacao] ?? nota.situacao}
                  </span>
                </td>
                <td className="px-3 py-2">
                  {nota.entrada_estoque_em ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                      Confirmada
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <Link href={`/admin/notas-entrada/${nota.id}`} className="text-xs text-blue-600 hover:underline">
                    Ver
                  </Link>
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
