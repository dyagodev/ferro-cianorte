"use client";

import { AlertCircle, CheckCircle2, FileText, Plus, Search, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "@/lib/apiClient";
import { CampoDinheiro } from "@/components/CampoDinheiro";
import { FORMAS_PAGAMENTO, type Cliente, type FormaPagamento, type Loja, type NotaFiscal, type Produto } from "@/lib/types";

type ItemNota = {
  produto: Produto;
  quantidade: number;
  precoUnitario: number;
};

export default function NfePage() {
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [lojaId, setLojaId] = useState<number | null>(null);

  const [buscaCliente, setBuscaCliente] = useState("");
  const [clientesEncontrados, setClientesEncontrados] = useState<Cliente[]>([]);
  const [cliente, setCliente] = useState<Cliente | null>(null);

  const [buscaProduto, setBuscaProduto] = useState("");
  const [produtosEncontrados, setProdutosEncontrados] = useState<Produto[]>([]);
  const [itens, setItens] = useState<ItemNota[]>([]);

  const [forma, setForma] = useState<FormaPagamento>("boleto");
  const [desconto, setDesconto] = useState(0);

  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<{ vendaId: number; nota: NotaFiscal } | null>(null);

  useEffect(() => {
    apiFetch<Loja[]>("lojas").then((dados) => {
      setLojas(dados);
      setLojaId((atual) => atual ?? dados.find((l) => l.ativo)?.id ?? dados[0]?.id ?? null);
    });
  }, []);

  useEffect(() => {
    const termo = buscaCliente.trim();
    if (termo.length < 2) {
      setClientesEncontrados([]);
      return;
    }
    const timer = setTimeout(() => {
      apiFetch<Cliente[]>(`clientes?q=${encodeURIComponent(termo)}`).then(setClientesEncontrados);
    }, 300);
    return () => clearTimeout(timer);
  }, [buscaCliente]);

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
      return [...atual, { produto, quantidade: 1, precoUnitario: Number(produto.preco_venda) }];
    });
    setBuscaProduto("");
    setProdutosEncontrados([]);
  }

  function removerItem(produtoId: number) {
    setItens((atual) => atual.filter((item) => item.produto.id !== produtoId));
  }

  function atualizarQuantidade(produtoId: number, quantidade: number) {
    setItens((atual) =>
      atual.map((item) => (item.produto.id === produtoId ? { ...item, quantidade: Math.max(0.001, quantidade) } : item)),
    );
  }

  const subtotal = itens.reduce((soma, item) => soma + item.quantidade * item.precoUnitario, 0);
  const total = Math.max(0, subtotal - desconto);

  const clienteSemEndereco =
    cliente && !(cliente.cpf_cnpj && cliente.cep && cliente.logradouro && cliente.numero && cliente.bairro && cliente.cidade && cliente.uf && cliente.codigo_municipio);

  async function emitir() {
    if (!lojaId || !cliente || itens.length === 0) return;

    setEnviando(true);
    setErro(null);
    setSucesso(null);

    try {
      const resposta = await apiFetch<{ venda_id: number; nota_fiscal: NotaFiscal }>("notas-fiscais/nfe", {
        method: "POST",
        body: JSON.stringify({
          loja_id: lojaId,
          cliente_id: cliente.id,
          desconto,
          itens: itens.map((item) => ({
            produto_id: item.produto.id,
            quantidade: item.quantidade,
            preco_unitario: item.precoUnitario,
          })),
          pagamentos: [{ forma_pagamento: forma, valor: total }],
        }),
      });

      setSucesso({ vendaId: resposta.venda_id, nota: resposta.nota_fiscal });
      setItens([]);
      setCliente(null);
      setDesconto(0);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível emitir a NF-e.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="max-w-3xl text-slate-900">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <FileText className="h-5 w-5 text-blue-600" />
          Emitir NF-e
        </h2>
      </div>

      <p className="mb-4 text-sm text-slate-500">
        Venda de produto pra outro CNPJ (atacado/revenda) — não passa pelo carrinho do PDV. O cliente precisa ter
        cadastro completo (CNPJ + endereço) pra emitir.
      </p>

      <div className="mb-4">
        <label className="mb-1 block text-sm text-slate-500">Loja emissora</label>
        {lojas.length > 1 ? (
          <select
            value={lojaId ?? ""}
            onChange={(e) => setLojaId(Number(e.target.value))}
            className="w-full max-w-sm rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
          >
            {lojas.map((loja) => (
              <option key={loja.id} value={loja.id}>
                {loja.nome}
              </option>
            ))}
          </select>
        ) : (
          <p className="text-sm text-slate-700">
            {lojas[0]?.nome ?? "Nenhuma loja cadastrada — cadastre uma loja antes de emitir."}
          </p>
        )}
      </div>

      <div className="mb-4">
        <label className="mb-1 block text-sm text-slate-500">Cliente (CNPJ)</label>
        {cliente ? (
          <div className="flex items-center justify-between rounded border border-slate-300 bg-white px-3 py-2">
            <span>
              {cliente.nome} — {cliente.cpf_cnpj ?? "sem documento"}
            </span>
            <button onClick={() => setCliente(null)} className="text-sm text-blue-600 hover:underline">
              Trocar
            </button>
          </div>
        ) : (
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={buscaCliente}
              onChange={(e) => setBuscaCliente(e.target.value)}
              placeholder="Buscar cliente por nome ou CNPJ..."
              className="w-full rounded border border-slate-300 bg-white py-2 pl-9 pr-3 text-slate-900 outline-none focus:border-blue-500"
            />
            {clientesEncontrados.length > 0 && (
              <ul className="absolute z-10 mt-1 w-full rounded border border-slate-300 bg-white shadow-lg">
                {clientesEncontrados.map((c) => (
                  <li key={c.id}>
                    <button
                      onClick={() => {
                        setCliente(c);
                        setBuscaCliente("");
                        setClientesEncontrados([]);
                      }}
                      className="w-full px-3 py-2 text-left hover:bg-slate-100"
                    >
                      {c.nome} — {c.cpf_cnpj ?? "sem documento"}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {clienteSemEndereco && (
          <p className="mt-1 flex items-center gap-1.5 text-sm text-amber-600">
            <AlertCircle className="h-4 w-4" />
            Esse cliente não tem CNPJ/endereço completo — complete o cadastro em Clientes antes de emitir.
          </p>
        )}
      </div>

      <div className="mb-4">
        <label className="mb-1 block text-sm text-slate-500">Adicionar produto</label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={buscaProduto}
            onChange={(e) => setBuscaProduto(e.target.value)}
            placeholder="Buscar produto por descrição ou código..."
            className="w-full rounded border border-slate-300 bg-white py-2 pl-9 pr-3 text-slate-900 outline-none focus:border-blue-500"
          />
          {produtosEncontrados.length > 0 && (
            <ul className="absolute z-10 mt-1 w-full rounded border border-slate-300 bg-white shadow-lg">
              {produtosEncontrados
                .map((p) => (
                  <li key={p.id}>
                    <button
                      onClick={() => adicionarItem(p)}
                      className="w-full px-3 py-2 text-left hover:bg-slate-100"
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
                    onChange={(e) => atualizarQuantidade(item.produto.id, Number(e.target.value) || 0)}
                    className="w-20 rounded border border-slate-300 bg-white px-2 py-1"
                  />
                </td>
                <td className="px-3 py-2">R$ {item.precoUnitario.toFixed(2)}</td>
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

      <div className="mb-4 grid grid-cols-3 gap-3">
        <div>
          <label className="mb-1 block text-sm text-slate-500">Desconto</label>
          <CampoDinheiro
            value={desconto}
            onChange={setDesconto}
            className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-500">Forma de pagamento</label>
          <select
            value={forma}
            onChange={(e) => setForma(e.target.value as FormaPagamento)}
            className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
          >
            {FORMAS_PAGAMENTO.map((opcao) => (
              <option key={opcao.valor} value={opcao.valor}>
                {opcao.rotulo}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col justify-end">
          <span className="text-sm text-slate-500">Total</span>
          <span className="text-xl font-bold">R$ {total.toFixed(2)}</span>
        </div>
      </div>

      {erro && (
        <p className="mb-4 flex items-center gap-1.5 text-sm text-red-600">
          <AlertCircle className="h-4 w-4" />
          {erro}
        </p>
      )}

      {sucesso && (
        <div className="mb-4 rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          <p className="mb-1 flex items-center gap-1.5 font-medium">
            <CheckCircle2 className="h-4 w-4" />
            Venda #{sucesso.vendaId} registrada, NF-e enviada (status: {sucesso.nota.status}).
          </p>
          {sucesso.nota.status === "authorized" && (
            <div className="flex flex-wrap gap-3 pl-5 text-xs">
              <a
                href={`/api/proxy/notas-fiscais/${sucesso.nota.id}/danfe`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                Baixar DANFE
              </a>
              <a
                href={`/api/proxy/notas-fiscais/${sucesso.nota.id}/xml`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                Baixar XML
              </a>
              {sucesso.nota.url_danfe && (
                <a
                  href={sucesso.nota.url_danfe}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  Ver nota (SEFAZ)
                </a>
              )}
            </div>
          )}
          {sucesso.nota.mensagem_retorno && sucesso.nota.status !== "authorized" && (
            <p className="pl-5 text-xs text-red-600">{sucesso.nota.mensagem_retorno}</p>
          )}
        </div>
      )}

      <button
        onClick={emitir}
        disabled={enviando || !cliente || itens.length === 0 || !lojaId}
        className="flex items-center gap-2 rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-500 disabled:opacity-50"
      >
        <Plus className="h-4 w-4" />
        {enviando ? "Emitindo..." : "Emitir NF-e"}
      </button>
    </div>
  );
}
