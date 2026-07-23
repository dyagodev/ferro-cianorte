"use client";

import { AlertCircle, PawPrint, Plus, Wrench } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/apiClient";
import type { OrdemServico, StatusOrdemServico } from "@/lib/types";

type PaginaOrdensServico = {
  data: OrdemServico[];
  current_page: number;
  last_page: number;
};

const ABAS: { valor: StatusOrdemServico | ""; rotulo: string }[] = [
  { valor: "", rotulo: "Todas" },
  { valor: "aberta", rotulo: "Abertas" },
  { valor: "em_execucao", rotulo: "Em execução" },
  { valor: "concluida", rotulo: "Concluídas" },
  { valor: "faturada", rotulo: "Faturadas" },
  { valor: "cancelada", rotulo: "Canceladas" },
];

function corStatus(status: StatusOrdemServico): string {
  if (status === "faturada") return "bg-emerald-100 text-emerald-700";
  if (status === "concluida") return "bg-blue-100 text-blue-700";
  if (status === "em_execucao") return "bg-amber-100 text-amber-700";
  if (status === "cancelada") return "bg-slate-200 text-slate-600";
  return "bg-slate-100 text-slate-600";
}

function rotuloStatus(status: StatusOrdemServico): string {
  if (status === "aberta") return "Aberta";
  if (status === "em_execucao") return "Em execução";
  if (status === "concluida") return "Concluída";
  if (status === "faturada") return "Faturada";
  return "Cancelada";
}

export default function OrdensServicoPage() {
  const [aba, setAba] = useState<StatusOrdemServico | "">("");
  const [pagina, setPagina] = useState(1);
  const [dados, setDados] = useState<PaginaOrdensServico | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function carregar() {
    setErro(null);
    const query = new URLSearchParams({ page: String(pagina) });
    if (aba) query.set("status", aba);
    try {
      setDados(await apiFetch<PaginaOrdensServico>(`ordens-servico?${query.toString()}`));
    } catch {
      setErro("Não foi possível carregar as ordens de serviço.");
    }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aba, pagina]);

  return (
    <div className="text-slate-900">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Wrench className="h-5 w-5 text-blue-600" />
          Ordens de Serviço
        </h2>
        <Link
          href="/admin/ordens-servico/nova"
          className="flex items-center gap-1.5 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
        >
          <Plus className="h-4 w-4" />
          Nova Ordem de Serviço
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
              aba === item.valor ? "border-b-2 border-blue-600 text-blue-600" : "text-slate-500 hover:text-slate-700"
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
              <th className="px-3 py-2">Cliente</th>
              <th className="px-3 py-2">Ativo</th>
              <th className="px-3 py-2">Itens</th>
              <th className="px-3 py-2">Total</th>
              <th className="px-3 py-2">Status</th>
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
                  Nenhuma ordem de serviço encontrada.
                </td>
              </tr>
            )}
            {dados?.data.map((os) => (
              <tr key={os.id} className="divide-x divide-slate-200 border-t border-slate-200">
                <td className="px-3 py-2">
                  <Link href={`/admin/ordens-servico/${os.id}`} className="text-blue-600 hover:underline">
                    #{os.id}
                  </Link>
                </td>
                <td className="px-3 py-2 whitespace-nowrap">{new Date(os.data_abertura).toLocaleString("pt-BR")}</td>
                <td className="px-3 py-2">{os.cliente?.nome ?? "—"}</td>
                <td className="px-3 py-2">
                  {os.ativo ? (
                    <span className="inline-flex items-center gap-1">
                      <PawPrint className="h-3.5 w-3.5 text-slate-400" />
                      {os.ativo.nome}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-3 py-2">{os.itens_count ?? os.itens?.length ?? "—"}</td>
                <td className="px-3 py-2">R$ {Number(os.total).toFixed(2)}</td>
                <td className="px-3 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${corStatus(os.status)}`}>
                    {rotuloStatus(os.status)}
                  </span>
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
