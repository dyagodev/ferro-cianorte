"use client";

import { AlertCircle, ArrowRightLeft, CheckCircle2, FileText, Plus, ScanBarcode, Trash2, Truck } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { apiFetch, ApiError } from "@/lib/apiClient";
import type { Loja, NotaFiscal, Produto } from "@/lib/types";

type ItemTransferencia = {
  produto: Produto;
  quantidade: number;
  precoUnitario: number;
};

export default function NovaTransferenciaPage() {
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [lojaOrigemId, setLojaOrigemId] = useState<number | null>(null);
  const [lojaDestinoId, setLojaDestinoId] = useState<number | null>(null);
  const [observacao, setObservacao] = useState("");

  const [codigoBarras, setCodigoBarras] = useState("");
  const [buscaProduto, setBuscaProduto] = useState("");
  const [produtosEncontrados, setProdutosEncontrados] = useState<Produto[]>([]);
  const [itens, setItens] = useState<ItemTransferencia[]>([]);

  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{ transferenciaId: number; nota: NotaFiscal | null } | null>(null);

  const inputBarcodeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    apiFetch<Loja[]>("lojas").then((dados) => {
      setLojas(dados);
      setLojaOrigemId((atual) => atual ?? dados.find((l) => l.ativo)?.id ?? dados[0]?.id ?? null);
    });
  }, []);

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

  function adicionarItem(produto: Produto) {
    setItens((atual) => {
      const existente = atual.find((item) => item.produto.id === produto.id);
      if (existente) {
        return atual.map((item) =>
          item.produto.id === produto.id ? { ...item, quantidade: item.quantidade + 1 } : item,
        );
      }
      const preco = Number(produto.preco_custo ?? produto.preco_venda ?? 0);
      return [...atual, { produto, quantidade: 1, precoUnitario: preco }];
    });
    setBuscaProduto("");
    setProdutosEncontrados([]);
  }

  async function lerCodigoBarras(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const codigo = codigoBarras.trim();
    if (!codigo) return;

    try {
      const encontrados = await apiFetch<Produto[]>(`produtos?q=${encodeURIComponent(codigo)}`);
      const exato = encontrados.find((p) => p.codigo_barras === codigo || p.codigo_interno === codigo);
      if (exato) {
        adicionarItem(exato);
      } else if (encontrados.length === 1) {
        adicionarItem(encontrados[0]);
      } else {
        window.alert(`Nenhum produto encontrado pro código "${codigo}".`);
      }
    } catch {
      window.alert("Não foi possível buscar o produto.");
    } finally {
      setCodigoBarras("");
      inputBarcodeRef.current?.focus();
    }
  }

  function removerItem(produtoId: number) {
    setItens((atual) => atual.filter((item) => item.produto.id !== produtoId));
  }

  function atualizarItem(produtoId: number, campo: "quantidade" | "precoUnitario", valor: number) {
    setItens((atual) =>
      atual.map((item) => (item.produto.id === produtoId ? { ...item, [campo]: Math.max(0, valor) } : item)),
    );
  }

  const total = itens.reduce((soma, item) => soma + item.quantidade * item.precoUnitario, 0);
  const lojaOrigem = lojas.find((l) => l.id === lojaOrigemId);
  const lojaDestino = lojas.find((l) => l.id === lojaDestinoId);

  async function criarTransferencia() {
    return apiFetch<{ id: number }>("transferencias-estoque", {
      method: "POST",
      body: JSON.stringify({
        loja_origem_id: lojaOrigemId,
        loja_destino_id: lojaDestinoId,
        observacao: observacao || null,
        itens: itens.map((item) => ({
          produto_id: item.produto.id,
          quantidade: item.quantidade,
          preco_unitario: item.precoUnitario,
        })),
      }),
    });
  }

  async function emitir() {
    if (!lojaOrigemId || !lojaDestinoId || itens.length === 0) return;

    setEnviando(true);
    setErro(null);

    try {
      const transferencia = await criarTransferencia();
      const emitida = await apiFetch<{ nota_fiscal: NotaFiscal }>(
        `transferencias-estoque/${transferencia.id}/emitir`,
        { method: "POST" },
      );

      setResultado({ transferenciaId: transferencia.id, nota: emitida.nota_fiscal });
      setItens([]);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível emitir a transferência.");
    } finally {
      setEnviando(false);
    }
  }

  async function confirmarSemNota() {
    if (!lojaOrigemId || !lojaDestinoId || itens.length === 0) return;
    if (!window.confirm("Confirmar transferência SEM nota fiscal? A origem já baixa o estoque na hora.")) return;

    setEnviando(true);
    setErro(null);

    try {
      const transferencia = await criarTransferencia();
      await apiFetch(`transferencias-estoque/${transferencia.id}/confirmar-sem-nota`, { method: "POST" });

      setResultado({ transferenciaId: transferencia.id, nota: null });
      setItens([]);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível confirmar a transferência.");
    } finally {
      setEnviando(false);
    }
  }

  if (resultado) {
    return (
      <div className="max-w-2xl text-slate-900">
        <div className="rounded border border-emerald-200 bg-emerald-50 p-6">
          <p className="mb-1 flex items-center gap-2 text-lg font-semibold text-emerald-700">
            <CheckCircle2 className="h-5 w-5" />
            {!resultado.nota
              ? "Transferência confirmada"
              : resultado.nota.status === "authorized"
                ? "Transferência emitida"
                : "Transferência criada"}
          </p>
          <p className="mb-4 text-sm text-emerald-700">
            {!resultado.nota
              ? `Transferência #${resultado.transferenciaId} confirmada sem nota fiscal — estoque da origem já baixado.`
              : `Transferência #${resultado.transferenciaId} — NF-e ${resultado.nota.status === "authorized" ? "autorizada" : resultado.nota.status}.`}
          </p>

          {resultado.nota?.status === "authorized" && (
            <div className="mb-4 flex flex-wrap gap-3 text-sm">
              <a
                href={`/api/proxy/notas-fiscais/${resultado.nota.id}/danfe`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                Baixar DANFE
              </a>
              <a
                href={`/api/proxy/notas-fiscais/${resultado.nota.id}/xml`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                Baixar XML
              </a>
            </div>
          )}

          {resultado.nota && resultado.nota.status !== "authorized" && resultado.nota.mensagem_retorno && (
            <p className="mb-4 text-sm text-red-600">{resultado.nota.mensagem_retorno}</p>
          )}

          <div className="flex flex-wrap gap-2">
            {resultado.nota?.status === "authorized" && (
              <Link
                href={`/admin/manifestos-transporte?transferencia_id=${resultado.transferenciaId}`}
                className="flex items-center gap-1.5 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
              >
                <Truck className="h-4 w-4" />
                Gerar MDF-e
              </Link>
            )}
            <Link
              href="/admin/transferencias"
              className="flex items-center gap-1.5 rounded border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              Ver todas as transferências
            </Link>
            <button
              onClick={() => setResultado(null)}
              className="flex items-center gap-1.5 rounded border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              <Plus className="h-4 w-4" />
              Nova transferência
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl text-slate-900">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
        <Truck className="h-5 w-5 text-blue-600" />
        Nova transferência de estoque
      </h2>

      <div className="mb-4 grid grid-cols-2 gap-4 rounded border border-slate-200 bg-slate-50 p-4">
        <div>
          <label className="mb-1 block text-sm text-slate-500">Loja de origem</label>
          <select
            value={lojaOrigemId ?? ""}
            onChange={(e) => setLojaOrigemId(Number(e.target.value))}
            className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
          >
            {lojas.map((loja) => (
              <option key={loja.id} value={loja.id}>
                {loja.nome}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 flex items-center gap-1 text-sm text-slate-500">
            <ArrowRightLeft className="h-3.5 w-3.5" />
            Loja de destino
          </label>
          <select
            value={lojaDestinoId ?? ""}
            onChange={(e) => setLojaDestinoId(Number(e.target.value))}
            className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
          >
            <option value="">Selecione...</option>
            {lojas
              .filter((l) => l.id !== lojaOrigemId)
              .map((loja) => (
                <option key={loja.id} value={loja.id}>
                  {loja.nome}
                </option>
              ))}
          </select>
        </div>
      </div>

      {lojaOrigem && lojaDestino && (
        <p className="mb-4 flex items-center gap-2 text-sm text-slate-500">
          {lojaOrigem.nome} <ArrowRightLeft className="h-3.5 w-3.5" /> {lojaDestino.nome}
        </p>
      )}

      <div className="mb-3 grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 flex items-center gap-1 text-sm text-slate-500">
            <ScanBarcode className="h-3.5 w-3.5" />
            Leitor de código de barras
          </label>
          <input
            ref={inputBarcodeRef}
            autoFocus
            value={codigoBarras}
            onChange={(e) => setCodigoBarras(e.target.value)}
            onKeyDown={lerCodigoBarras}
            placeholder="Bipe o produto ou digite o código e Enter"
            className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
          />
        </div>
        <div className="relative">
          <label className="mb-1 block text-sm text-slate-500">Ou buscar por descrição</label>
          <input
            value={buscaProduto}
            onChange={(e) => setBuscaProduto(e.target.value)}
            placeholder="Buscar produto..."
            className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
          />
          {produtosEncontrados.length > 0 && (
            <ul className="absolute z-10 mt-1 w-full rounded border border-slate-300 bg-white shadow-lg">
              {produtosEncontrados.map((p) => (
                <li key={p.id}>
                  <button
                    onClick={() => adicionarItem(p)}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-slate-100"
                  >
                    {p.descricao} — R$ {Number(p.preco_venda).toFixed(2)}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="mb-4 overflow-auto rounded border border-slate-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr className="divide-x divide-slate-200">
              <th className="px-3 py-2">Produto</th>
              <th className="px-3 py-2">Qtd</th>
              <th className="px-3 py-2">Preço unit.</th>
              <th className="px-3 py-2">Total</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {itens.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-slate-500">
                  Nenhum item adicionado.
                </td>
              </tr>
            )}
            {itens.map((item) => (
              <tr key={item.produto.id} className="divide-x divide-slate-200 border-t border-slate-200">
                <td className="px-3 py-2">{item.produto.descricao}</td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    step="0.001"
                    value={item.quantidade}
                    onChange={(e) => atualizarItem(item.produto.id, "quantidade", Number(e.target.value) || 0)}
                    className="w-20 rounded border border-slate-300 bg-white px-2 py-1"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    step="0.01"
                    value={item.precoUnitario}
                    onChange={(e) => atualizarItem(item.produto.id, "precoUnitario", Number(e.target.value) || 0)}
                    className="w-24 rounded border border-slate-300 bg-white px-2 py-1"
                  />
                </td>
                <td className="px-3 py-2">R$ {(item.quantidade * item.precoUnitario).toFixed(2)}</td>
                <td className="px-3 py-2">
                  <button
                    onClick={() => removerItem(item.produto.id)}
                    className="rounded p-1 text-red-500 hover:bg-red-50"
                    title="Remover"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mb-4">
        <label className="mb-1 block text-sm text-slate-500">Observação (opcional)</label>
        <input
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
          className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
        />
      </div>

      <div className="mb-4 flex items-center justify-between rounded border border-slate-200 bg-slate-50 p-4">
        <span className="text-sm text-slate-500">Total da transferência</span>
        <span className="text-xl font-bold">R$ {total.toFixed(2)}</span>
      </div>

      {erro && (
        <p className="mb-4 flex items-center gap-1.5 text-sm text-red-600">
          <AlertCircle className="h-4 w-4" />
          {erro}
        </p>
      )}

      <div className="flex gap-2">
        <button
          onClick={emitir}
          disabled={enviando || !lojaOrigemId || !lojaDestinoId || itens.length === 0}
          className="flex items-center gap-2 rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-500 disabled:opacity-50"
        >
          <FileText className="h-4 w-4" />
          {enviando ? "Enviando..." : "Emitir documentos"}
        </button>
        <button
          onClick={confirmarSemNota}
          disabled={enviando || !lojaOrigemId || !lojaDestinoId || itens.length === 0}
          className="flex items-center gap-2 rounded border border-slate-300 px-4 py-2 font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
          title="Pra transferência que não precisa de nota fiscal"
        >
          {enviando ? "Enviando..." : "Confirmar sem nota fiscal"}
        </button>
      </div>
    </div>
  );
}
