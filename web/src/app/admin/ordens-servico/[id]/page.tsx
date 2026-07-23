"use client";

import { AlertCircle, ArrowLeft, CheckCircle2, ReceiptText, Tag, Trash2, Wrench, XCircle } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "@/lib/apiClient";
import PagamentoModal from "@/app/pdv/pagamento-modal";
import type { FormaPagamento, ItemVendavel, OrdemServico, Produto, Servico, StatusOrdemServico } from "@/lib/types";

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

export default function DetalheOrdemServicoPage() {
  const params = useParams<{ id: string }>();
  const [os, setOs] = useState<OrdemServico | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [processando, setProcessando] = useState(false);
  const [modalPagamentoAberto, setModalPagamentoAberto] = useState(false);

  const [buscaProduto, setBuscaProduto] = useState("");
  const [produtosEncontrados, setProdutosEncontrados] = useState<Produto[]>([]);
  const [servicosCatalogo, setServicosCatalogo] = useState<Servico[]>([]);

  useEffect(() => {
    apiFetch<Servico[]>("servicos").then(setServicosCatalogo);
  }, []);

  const servicosEncontrados =
    buscaProduto.trim().length < 2
      ? []
      : servicosCatalogo.filter((s) => s.descricao.toLowerCase().includes(buscaProduto.trim().toLowerCase()));

  async function carregar() {
    try {
      setOs(await apiFetch<OrdemServico>(`ordens-servico/${params.id}`));
    } catch {
      setErro("Não foi possível carregar essa ordem de serviço.");
    }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  useEffect(() => {
    const termo = buscaProduto.trim();
    if (termo.length < 2) {
      setProdutosEncontrados([]);
      return;
    }
    const timer = setTimeout(() => {
      apiFetch<Produto[]>(`produtos?q=${encodeURIComponent(termo)}`).then(setProdutosEncontrados);
    }, 300);
    return () => clearTimeout(timer);
  }, [buscaProduto]);

  async function adicionarItem(vendavel: ItemVendavel) {
    if (!os) return;
    setErro(null);
    try {
      await apiFetch(`ordens-servico/${os.id}/itens`, {
        method: "POST",
        body: JSON.stringify({
          produto_id: vendavel.tipo === "produto" ? vendavel.item.id : null,
          servico_id: vendavel.tipo === "servico" ? vendavel.item.id : null,
          quantidade: 1,
          preco_unitario: Number(vendavel.item.preco_venda ?? 0),
        }),
      });
      setBuscaProduto("");
      setProdutosEncontrados([]);
      await carregar();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível adicionar o item.");
    }
  }

  async function removerItem(itemId: number) {
    if (!os) return;
    setErro(null);
    try {
      await apiFetch(`ordens-servico/${os.id}/itens/${itemId}`, { method: "DELETE" });
      await carregar();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível remover o item.");
    }
  }

  async function mudarStatus(novoStatus: StatusOrdemServico) {
    if (!os) return;
    setProcessando(true);
    setErro(null);
    try {
      await apiFetch(`ordens-servico/${os.id}/status`, { method: "POST", body: JSON.stringify({ status: novoStatus }) });
      await carregar();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível mudar o status.");
    } finally {
      setProcessando(false);
    }
  }

  async function cancelar() {
    if (!os) return;
    if (!window.confirm("Cancelar essa Ordem de Serviço?")) return;
    setProcessando(true);
    setErro(null);
    try {
      await apiFetch(`ordens-servico/${os.id}/cancelar`, { method: "POST" });
      await carregar();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível cancelar.");
    } finally {
      setProcessando(false);
    }
  }

  async function faturar(pagamentos: { forma_pagamento: FormaPagamento; valor: number }[]) {
    if (!os) return;
    await apiFetch(`ordens-servico/${os.id}/faturar`, {
      method: "POST",
      body: JSON.stringify({ pagamentos }),
    });
    setModalPagamentoAberto(false);
    await carregar();
  }

  if (erro && !os) {
    return (
      <p className="flex items-center gap-1.5 text-sm text-red-600">
        <AlertCircle className="h-4 w-4" />
        {erro}
      </p>
    );
  }

  if (!os) {
    return <p className="text-sm text-slate-500">Carregando...</p>;
  }

  return (
    <div className="max-w-3xl text-slate-900">
      <Link href="/admin/ordens-servico" className="mb-3 flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" />
        Voltar
      </Link>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Wrench className="h-5 w-5 text-blue-600" />
          Ordem de Serviço #{os.id}
        </h2>
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${corStatus(os.status)}`}>{rotuloStatus(os.status)}</span>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-4 rounded border border-slate-200 bg-slate-50 p-4 text-sm">
        <div>
          <p className="text-slate-500">Cliente</p>
          <p className="font-medium">{os.cliente?.nome ?? "—"}</p>
        </div>
        <div>
          <p className="text-slate-500">Item do cliente</p>
          <p className="flex items-center gap-1 font-medium">
            {os.ativo ? (
              <>
                <Tag className="h-3.5 w-3.5 text-slate-400" />
                {os.ativo.nome}
              </>
            ) : (
              "—"
            )}
          </p>
        </div>
        <div>
          <p className="text-slate-500">Loja</p>
          <p className="font-medium">{os.loja?.nome ?? "—"}</p>
        </div>
        <div>
          <p className="text-slate-500">Aberta em</p>
          <p className="font-medium">{new Date(os.data_abertura).toLocaleString("pt-BR")}</p>
        </div>
        {os.descricao_problema && (
          <div className="col-span-2">
            <p className="text-slate-500">Descrição do problema</p>
            <p className="font-medium">{os.descricao_problema}</p>
          </div>
        )}
      </div>

      {["aberta", "em_execucao"].includes(os.status) && (
        <div className="relative mb-4">
          <label className="mb-1 block text-sm text-slate-500">Adicionar item (produto ou serviço)</label>
          <input
            value={buscaProduto}
            onChange={(e) => setBuscaProduto(e.target.value)}
            placeholder="Buscar..."
            className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
          />
          {(produtosEncontrados.length > 0 || servicosEncontrados.length > 0) && (
            <ul className="absolute z-10 mt-1 w-full rounded border border-slate-300 bg-white shadow-lg">
              {servicosEncontrados.map((s) => (
                <li key={`servico-${s.id}`}>
                  <button
                    onClick={() => adicionarItem({ tipo: "servico", item: s })}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-slate-100"
                  >
                    {s.descricao} — R$ {Number(s.preco_venda).toFixed(2)}
                    <span className="ml-2 rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700">serviço</span>
                  </button>
                </li>
              ))}
              {produtosEncontrados.map((p) => (
                <li key={`produto-${p.id}`}>
                  <button
                    onClick={() => adicionarItem({ tipo: "produto", item: p })}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-slate-100"
                  >
                    {p.descricao} — R$ {Number(p.preco_venda).toFixed(2)}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="mb-4 overflow-auto rounded border border-slate-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr className="divide-x divide-slate-200">
              <th className="px-3 py-2">Item</th>
              <th className="px-3 py-2">Qtd</th>
              <th className="px-3 py-2">Preço unit.</th>
              <th className="px-3 py-2">Total</th>
              {["aberta", "em_execucao"].includes(os.status) && <th className="px-3 py-2" />}
            </tr>
          </thead>
          <tbody>
            {(!os.itens || os.itens.length === 0) && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-slate-500">
                  Nenhum item adicionado.
                </td>
              </tr>
            )}
            {os.itens?.map((item) => (
              <tr key={item.id} className="divide-x divide-slate-200 border-t border-slate-200">
                <td className="px-3 py-2">
                  {item.produto?.descricao ?? item.servico?.descricao ?? "—"}
                  {item.servico_id && (
                    <span className="ml-2 rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700">serviço</span>
                  )}
                </td>
                <td className="px-3 py-2">{item.quantidade}</td>
                <td className="px-3 py-2">R$ {Number(item.preco_unitario).toFixed(2)}</td>
                <td className="px-3 py-2">R$ {Number(item.total).toFixed(2)}</td>
                {["aberta", "em_execucao"].includes(os.status) && (
                  <td className="px-3 py-2">
                    <button
                      onClick={() => removerItem(item.id)}
                      className="rounded p-1 text-red-500 hover:bg-red-50"
                      title="Remover"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mb-4 flex items-center justify-between rounded border border-slate-200 bg-slate-50 p-4">
        <span className="text-sm text-slate-500">Total</span>
        <span className="text-xl font-bold">R$ {Number(os.total).toFixed(2)}</span>
      </div>

      {erro && (
        <p className="mb-4 flex items-center gap-1.5 text-sm text-red-600">
          <AlertCircle className="h-4 w-4" />
          {erro}
        </p>
      )}

      {os.status === "faturada" && os.venda_id && (
        <p className="mb-4 flex items-center gap-1.5 text-sm text-emerald-700">
          <CheckCircle2 className="h-4 w-4" />
          Faturada — Venda #{os.venda_id} gerada.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {os.status === "aberta" && (
          <button
            onClick={() => mudarStatus("em_execucao")}
            disabled={processando}
            className="flex items-center gap-2 rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-500 disabled:opacity-50"
          >
            Iniciar execução
          </button>
        )}
        {os.status === "em_execucao" && (
          <button
            onClick={() => mudarStatus("concluida")}
            disabled={processando}
            className="flex items-center gap-2 rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-500 disabled:opacity-50"
          >
            <CheckCircle2 className="h-4 w-4" />
            Concluir
          </button>
        )}
        {os.status === "concluida" && (
          <button
            onClick={() => setModalPagamentoAberto(true)}
            disabled={processando || !os.itens?.length}
            className="flex items-center gap-2 rounded bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            <ReceiptText className="h-4 w-4" />
            Faturar
          </button>
        )}
        {["aberta", "em_execucao"].includes(os.status) && (
          <button
            onClick={cancelar}
            disabled={processando}
            className="flex items-center gap-2 rounded border border-slate-300 px-4 py-2 font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            <XCircle className="h-4 w-4" />
            Cancelar OS
          </button>
        )}
      </div>

      {modalPagamentoAberto && (
        <PagamentoModal
          total={Number(os.total)}
          clienteNome={os.cliente?.nome ?? "—"}
          possuiEmissaoFiscalConfigurada={false}
          onFechar={() => setModalPagamentoAberto(false)}
          onConfirmar={async (pagamentos) => faturar(pagamentos)}
        />
      )}
    </div>
  );
}
