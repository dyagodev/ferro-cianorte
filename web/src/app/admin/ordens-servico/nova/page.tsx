"use client";

import { AlertCircle, PawPrint, ScanBarcode, Trash2, Wrench } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { apiFetch, ApiError } from "@/lib/apiClient";
import type { Ativo, Cliente, Loja, OrdemServico, Produto } from "@/lib/types";

type ItemOS = {
  produto: Produto;
  quantidade: number;
  precoUnitario: number;
};

export default function NovaOrdemServicoPage() {
  const router = useRouter();

  const [lojas, setLojas] = useState<Loja[]>([]);
  const [lojaId, setLojaId] = useState<number | null>(null);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [clienteId, setClienteId] = useState<number | null>(null);
  const [ativos, setAtivos] = useState<Ativo[]>([]);
  const [ativoId, setAtivoId] = useState<number | null>(null);

  const [descricaoProblema, setDescricaoProblema] = useState("");
  const [observacoes, setObservacoes] = useState("");

  const [codigoBarras, setCodigoBarras] = useState("");
  const [buscaProduto, setBuscaProduto] = useState("");
  const [produtosEncontrados, setProdutosEncontrados] = useState<Produto[]>([]);
  const [itens, setItens] = useState<ItemOS[]>([]);

  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const inputBarcodeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    apiFetch<Loja[]>("lojas").then((dados) => {
      setLojas(dados);
      setLojaId((atual) => atual ?? dados.find((l) => l.ativo)?.id ?? dados[0]?.id ?? null);
    });
    apiFetch<Cliente[]>("clientes").then(setClientes);
  }, []);

  useEffect(() => {
    setAtivoId(null);
    if (!clienteId) {
      setAtivos([]);
      return;
    }
    apiFetch<Ativo[]>(`ativos?cliente_id=${clienteId}`).then(setAtivos);
  }, [clienteId]);

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
      return [...atual, { produto, quantidade: 1, precoUnitario: Number(produto.preco_venda ?? 0) }];
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

  async function criar() {
    if (!lojaId || !clienteId) return;

    setEnviando(true);
    setErro(null);

    try {
      const os = await apiFetch<OrdemServico>("ordens-servico", {
        method: "POST",
        body: JSON.stringify({
          loja_id: lojaId,
          cliente_id: clienteId,
          ativo_id: ativoId,
          descricao_problema: descricaoProblema || null,
          observacoes: observacoes || null,
          itens: itens.map((item) => ({
            produto_id: item.produto.id,
            quantidade: item.quantidade,
            preco_unitario: item.precoUnitario,
          })),
        }),
      });

      router.push(`/admin/ordens-servico/${os.id}`);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível criar a ordem de serviço.");
      setEnviando(false);
    }
  }

  return (
    <div className="max-w-4xl text-slate-900">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
        <Wrench className="h-5 w-5 text-blue-600" />
        Nova Ordem de Serviço
      </h2>

      <div className="mb-4 grid grid-cols-3 gap-4 rounded border border-slate-200 bg-slate-50 p-4">
        <div>
          <label className="mb-1 block text-sm text-slate-500">Loja</label>
          <select
            value={lojaId ?? ""}
            onChange={(e) => setLojaId(Number(e.target.value))}
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
          <label className="mb-1 block text-sm text-slate-500">Cliente</label>
          <select
            value={clienteId ?? ""}
            onChange={(e) => setClienteId(Number(e.target.value) || null)}
            className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
          >
            <option value="">Selecione...</option>
            {clientes.map((cliente) => (
              <option key={cliente.id} value={cliente.id}>
                {cliente.nome}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 flex items-center gap-1 text-sm text-slate-500">
            <PawPrint className="h-3.5 w-3.5" />
            Ativo (opcional)
          </label>
          <select
            value={ativoId ?? ""}
            onChange={(e) => setAtivoId(Number(e.target.value) || null)}
            disabled={!clienteId}
            className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500 disabled:opacity-50"
          >
            <option value="">Nenhum</option>
            {ativos.map((ativo) => (
              <option key={ativo.id} value={ativo.id}>
                {ativo.nome}
                {ativo.tipo ? ` (${ativo.tipo})` : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mb-4">
        <label className="mb-1 block text-sm text-slate-500">Descrição do problema / solicitação</label>
        <textarea
          value={descricaoProblema}
          onChange={(e) => setDescricaoProblema(e.target.value)}
          rows={2}
          className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
        />
      </div>

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
          <label className="mb-1 block text-sm text-slate-500">Ou buscar produto/serviço</label>
          <input
            value={buscaProduto}
            onChange={(e) => setBuscaProduto(e.target.value)}
            placeholder="Buscar..."
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
                    {p.natureza === "servico" && (
                      <span className="ml-2 rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700">serviço</span>
                    )}
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
              <th className="px-3 py-2">Item</th>
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
                <td className="px-3 py-2">
                  {item.produto.descricao}
                  {item.produto.natureza === "servico" && (
                    <span className="ml-2 rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700">serviço</span>
                  )}
                </td>
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
        <label className="mb-1 block text-sm text-slate-500">Observações (opcional)</label>
        <textarea
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          rows={2}
          className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
        />
      </div>

      <div className="mb-4 flex items-center justify-between rounded border border-slate-200 bg-slate-50 p-4">
        <span className="text-sm text-slate-500">Total estimado</span>
        <span className="text-xl font-bold">R$ {total.toFixed(2)}</span>
      </div>

      {erro && (
        <p className="mb-4 flex items-center gap-1.5 text-sm text-red-600">
          <AlertCircle className="h-4 w-4" />
          {erro}
        </p>
      )}

      <button
        onClick={criar}
        disabled={enviando || !lojaId || !clienteId}
        className="flex items-center gap-2 rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-500 disabled:opacity-50"
      >
        <Wrench className="h-4 w-4" />
        {enviando ? "Criando..." : "Abrir Ordem de Serviço"}
      </button>
    </div>
  );
}
