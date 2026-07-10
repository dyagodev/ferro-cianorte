"use client";

import {
  AlertCircle,
  CheckCircle2,
  LayoutDashboard,
  LogOut,
  Percent,
  Printer,
  ScanBarcode,
  Search,
  ShoppingBag,
  ShoppingCart,
  Trash2,
  UserRound,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "@/lib/apiClient";
import type { Cliente, Loja, Produto } from "@/lib/types";
import ClienteModal from "./cliente-modal";
import Cupom, { type VendaConcluida } from "./cupom";
import MenuModal from "./menu-modal";
import PagamentoModal from "./pagamento-modal";
import ProdutoModal from "./produto-modal";

type TipoDesconto = "valor" | "percentual";

type ItemCarrinho = {
  produto: Produto;
  quantidade: number;
  precoVendido: number;
};

export default function PdvScreen({
  role,
  nomeUsuario,
  lojaIdSessao,
}: {
  role: "admin" | "vendedor";
  nomeUsuario: string;
  lojaIdSessao: number | null;
}) {
  const router = useRouter();
  const [busca, setBusca] = useState("");
  const [resultados, setResultados] = useState<Produto[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [modalPagamentoAberto, setModalPagamentoAberto] = useState(false);
  const [modalClienteAberto, setModalClienteAberto] = useState(false);
  const [modalProdutoAberto, setModalProdutoAberto] = useState(false);
  const [modalMenuAberto, setModalMenuAberto] = useState(false);
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [lojaSelecionadaId, setLojaSelecionadaId] = useState<number | null>(null);
  const [ultimaVenda, setUltimaVenda] = useState<VendaConcluida | null>(null);
  const [descontoTipo, setDescontoTipo] = useState<TipoDesconto>("valor");
  const [descontoTexto, setDescontoTexto] = useState("0");
  const buscaRef = useRef<HTMLInputElement>(null);

  // Sempre carrega as lojas: admin escolhe em qual está vendendo, vendedor só usa
  // pra exibir o nome da própria loja no cupom.
  useEffect(() => {
    apiFetch<Loja[]>("lojas").then((dados) => {
      setLojas(dados);
      if (role === "admin") {
        setLojaSelecionadaId((atual) => atual ?? dados.find((l) => l.ativo)?.id ?? dados[0]?.id ?? null);
      }
    });
  }, [role]);

  const lojaId = role === "admin" ? lojaSelecionadaId : lojaIdSessao;
  const lojaNome = lojas.find((loja) => loja.id === lojaId)?.nome ?? "Ferro Cianorte";

  const subtotal = useMemo(
    () => carrinho.reduce((soma, item) => soma + item.quantidade * item.precoVendido, 0),
    [carrinho],
  );

  const descontoReais = useMemo(() => {
    const valor = Number(descontoTexto) || 0;
    const bruto = descontoTipo === "percentual" ? (subtotal * valor) / 100 : valor;
    return Math.min(Math.max(bruto, 0), subtotal);
  }, [descontoTexto, descontoTipo, subtotal]);

  const total = subtotal - descontoReais;

  // Atalhos idênticos ao sistema de referência: F10-Cliente, F9-Opções (finalizar), Ctrl+M-Menu.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "F3") {
        event.preventDefault();
        setModalProdutoAberto(true);
      } else if (event.key === "F10") {
        event.preventDefault();
        setModalClienteAberto(true);
      } else if (event.key === "F9") {
        event.preventDefault();
        if (carrinho.length > 0) setModalPagamentoAberto(true);
      } else if (event.ctrlKey && event.key.toLowerCase() === "m") {
        event.preventDefault();
        setModalMenuAberto(true);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [carrinho.length]);

  // Busca automática (com debounce) conforme o usuário digita, tipo autocomplete —
  // não adiciona nada sozinho, só popula a lista pra clicar. O Enter (buscarProdutos)
  // continua existindo à parte pro leitor de código de barras, que já manda o texto
  // completo de uma vez e espera adicionar direto quando há um único resultado exato.
  useEffect(() => {
    const termo = busca.trim();
    if (termo.length < 2) {
      setResultados([]);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => {
      setBuscando(true);
      setErro(null);

      const query = new URLSearchParams({ q: termo });
      if (role === "admin" && lojaId) query.set("loja_id", String(lojaId));

      apiFetch<Produto[]>(`produtos?${query.toString()}`, { signal: controller.signal })
        .then(setResultados)
        .catch((err) => {
          if (err instanceof DOMException && err.name === "AbortError") return;
          setErro("Não foi possível buscar produtos.");
        })
        .finally(() => setBuscando(false));
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [busca, role, lojaId]);

  async function buscarProdutos() {
    if (!busca.trim()) return;
    setBuscando(true);
    setErro(null);

    try {
      const query = new URLSearchParams({ q: busca });
      if (role === "admin" && lojaId) query.set("loja_id", String(lojaId));
      const produtos = await apiFetch<Produto[]>(`produtos?${query.toString()}`);

      if (produtos.length === 1) {
        adicionarAoCarrinho(produtos[0]);
        setBusca("");
        setResultados([]);
      } else {
        setResultados(produtos);
      }
    } catch {
      setErro("Não foi possível buscar produtos.");
    } finally {
      setBuscando(false);
    }
  }

  function adicionarAoCarrinho(produto: Produto) {
    setCarrinho((atual) => {
      const existente = atual.find((item) => item.produto.id === produto.id);
      if (existente) {
        return atual.map((item) =>
          item.produto.id === produto.id ? { ...item, quantidade: item.quantidade + 1 } : item,
        );
      }
      return [...atual, { produto, quantidade: 1, precoVendido: Number(produto.preco_venda) }];
    });
    setResultados([]);
    buscaRef.current?.focus();
  }

  function atualizarQuantidade(produtoId: number, quantidade: number) {
    if (quantidade <= 0) {
      removerItem(produtoId);
      return;
    }
    setCarrinho((atual) =>
      atual.map((item) => (item.produto.id === produtoId ? { ...item, quantidade } : item)),
    );
  }

  function atualizarPrecoVendido(produtoId: number, preco: number) {
    setCarrinho((atual) =>
      atual.map((item) =>
        item.produto.id === produtoId ? { ...item, precoVendido: Math.max(0, preco) } : item,
      ),
    );
  }

  function removerItem(produtoId: number) {
    setCarrinho((atual) => atual.filter((item) => item.produto.id !== produtoId));
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  async function confirmarVenda(pagamentos: { forma_pagamento: string; valor: number }[]) {
    const venda = await apiFetch<{ id: number; created_at: string }>("vendas", {
      method: "POST",
      body: JSON.stringify({
        cliente_id: cliente?.id ?? null,
        loja_id: role === "admin" ? lojaId : undefined,
        desconto: descontoReais,
        itens: carrinho.map((item) => ({
          produto_id: item.produto.id,
          quantidade: item.quantidade,
          preco_unitario: item.precoVendido,
        })),
        pagamentos,
      }),
    });

    setUltimaVenda({
      id: venda.id,
      dataHora: venda.created_at,
      lojaNome,
      vendedorNome: nomeUsuario,
      clienteNome: cliente?.nome ?? "não informado",
      itens: carrinho.map((item) => ({
        descricao: item.produto.descricao,
        quantidade: item.quantidade,
        precoOriginal: Number(item.produto.preco_venda),
        precoUnitario: item.precoVendido,
      })),
      pagamentos: pagamentos as VendaConcluida["pagamentos"],
      subtotal,
      desconto: descontoReais,
      total,
    });

    setCarrinho([]);
    setCliente(null);
    setDescontoTexto("0");
    setModalPagamentoAberto(false);
    buscaRef.current?.focus();
  }

  function imprimirCupom() {
    window.print();
    setUltimaVenda(null);
  }

  return (
    <>
    <div className="flex flex-1 flex-col bg-white print:hidden">
      <header className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2">
        <h1 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <ShoppingBag className="h-5 w-5 text-blue-600" />
          Ferro Cianorte
        </h1>
        <div className="flex items-center gap-3 text-sm text-slate-600">
          {role === "admin" && (
            <select
              value={lojaSelecionadaId ?? ""}
              onChange={(e) => setLojaSelecionadaId(Number(e.target.value))}
              className="rounded border border-slate-300 bg-white px-2 py-1"
            >
              {lojas.map((loja) => (
                <option key={loja.id} value={loja.id}>
                  Vendendo em: {loja.nome}
                </option>
              ))}
            </select>
          )}
          {role === "admin" && (
            <a
              href="/admin"
              className="flex items-center gap-1.5 rounded border border-slate-300 px-3 py-1 hover:bg-slate-100"
            >
              <LayoutDashboard className="h-4 w-4" />
              Área administrativa
            </a>
          )}
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 rounded border border-slate-300 px-3 py-1 hover:bg-slate-100"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </div>
      </header>

      <main className="flex flex-1 flex-col gap-4 p-4">
        <div className="relative">
          <label className="mb-1 block text-sm text-slate-500">Código de barras ou descrição</label>
          <div className="relative">
            <ScanBarcode className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              ref={buscaRef}
              autoFocus
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && buscarProdutos()}
              placeholder="Digite ou passe o leitor de código de barras..."
              className="w-full rounded border border-slate-300 bg-slate-50 py-3 pl-11 pr-4 text-xl text-slate-900 outline-none focus:border-blue-500"
            />
          </div>
          {buscando && <p className="mt-1 text-sm text-slate-500">Buscando...</p>}

          {resultados.length > 0 && (
            <ul className="absolute z-10 mt-1 w-full rounded border border-slate-300 bg-slate-50 shadow-xl">
              {resultados.map((produto) => (
                <li key={produto.id}>
                  <button
                    onClick={() => adicionarAoCarrinho(produto)}
                    className="flex w-full items-center justify-between px-4 py-2 text-left text-slate-900 hover:bg-slate-100"
                  >
                    <span>{produto.descricao}</span>
                    <span className="text-slate-500">R$ {Number(produto.preco_venda).toFixed(2)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {erro && (
          <p className="flex items-center gap-1.5 text-sm text-red-600">
            <AlertCircle className="h-4 w-4" />
            {erro}
          </p>
        )}

        <div className="flex-1 overflow-auto rounded border border-slate-200">
          <table className="w-full text-left text-slate-900">
            <thead className="bg-slate-50 text-sm text-slate-500">
              <tr>
                <th className="px-3 py-2">Descrição</th>
                <th className="px-3 py-2">Qtd.</th>
                <th className="px-3 py-2">Preço Unit. R$</th>
                <th className="px-3 py-2">Total R$</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {carrinho.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-10 text-center text-slate-500">
                    <ShoppingCart className="mx-auto mb-2 h-8 w-8 text-slate-300" />
                    <span className="font-medium text-red-600">CAIXA LIVRE</span>
                  </td>
                </tr>
              )}
              {carrinho.map((item) => (
                <tr key={item.produto.id} className="border-t border-slate-200">
                  <td className="px-3 py-2">{item.produto.descricao}</td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={0}
                      step="0.001"
                      value={item.quantidade}
                      onChange={(e) => atualizarQuantidade(item.produto.id, Number(e.target.value))}
                      className="w-20 rounded border border-slate-300 bg-white px-2 py-1"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={item.precoVendido}
                      onChange={(e) => atualizarPrecoVendido(item.produto.id, Number(e.target.value))}
                      className={`w-24 rounded border px-2 py-1 ${
                        item.precoVendido !== Number(item.produto.preco_venda)
                          ? "border-amber-400 bg-amber-50"
                          : "border-slate-300 bg-white"
                      }`}
                    />
                    {item.precoVendido !== Number(item.produto.preco_venda) && (
                      <p className="text-xs text-slate-500 line-through">
                        R$ {Number(item.produto.preco_venda).toFixed(2)}
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-2">{(item.quantidade * item.precoVendido).toFixed(2)}</td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => removerItem(item.produto.id)}
                      className="flex items-center gap-1 text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                      Remover
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-600">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1">
              <Percent className="h-4 w-4 text-slate-400" />
              Desconto:
            </span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={descontoTexto}
              onChange={(e) => setDescontoTexto(e.target.value)}
              className="w-24 rounded border border-slate-300 bg-white px-2 py-1 text-slate-900"
            />
            <div className="flex overflow-hidden rounded border border-slate-300">
              <button
                onClick={() => setDescontoTipo("valor")}
                className={`px-2 py-1 ${descontoTipo === "valor" ? "bg-blue-600 text-white" : "bg-white text-slate-600"}`}
              >
                R$
              </button>
              <button
                onClick={() => setDescontoTipo("percentual")}
                className={`px-2 py-1 ${descontoTipo === "percentual" ? "bg-blue-600 text-white" : "bg-white text-slate-600"}`}
              >
                %
              </button>
            </div>
          </div>
          <div className="flex items-center gap-4 text-slate-500">
            <span>Subtotal: R$ {subtotal.toFixed(2)}</span>
            {descontoReais > 0 && <span className="text-amber-600">Desconto: -R$ {descontoReais.toFixed(2)}</span>}
          </div>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-600">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <UserRound className="h-4 w-4 text-slate-400" />
              Usuário: {nomeUsuario || "—"}
            </span>
            <button
              onClick={() => setModalClienteAberto(true)}
              className="flex items-center gap-1.5 hover:text-slate-900"
            >
              <UserRound className="h-4 w-4" />
              F10 - Cliente: {cliente ? cliente.nome : "não informado"}
            </button>
            <button
              onClick={() => setModalProdutoAberto(true)}
              className="flex items-center gap-1.5 hover:text-slate-900"
            >
              <Search className="h-4 w-4" />
              F3 - Buscar Produto
            </button>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-2xl font-semibold text-slate-900">Total: R$ {total.toFixed(2)}</span>
            <button
              onClick={() => setModalMenuAberto(true)}
              className="flex items-center gap-1.5 hover:text-slate-900"
            >
              <LayoutDashboard className="h-4 w-4" />
              Ctrl+M - Menu
            </button>
            <button
              onClick={() => carrinho.length > 0 && setModalPagamentoAberto(true)}
              disabled={carrinho.length === 0}
              className="flex items-center gap-2 rounded bg-blue-600 px-6 py-2 text-lg font-medium text-white hover:bg-blue-500 disabled:opacity-50"
            >
              <CheckCircle2 className="h-5 w-5" />
              F9 - Opções
            </button>
          </div>
        </footer>
      </main>

      {modalClienteAberto && (
        <ClienteModal
          onFechar={() => setModalClienteAberto(false)}
          onSelecionar={(selecionado) => {
            setCliente(selecionado);
            setModalClienteAberto(false);
            buscaRef.current?.focus();
          }}
        />
      )}

      {modalProdutoAberto && (
        <ProdutoModal
          lojaId={lojaId}
          onFechar={() => setModalProdutoAberto(false)}
          onSelecionar={(produto) => {
            adicionarAoCarrinho(produto);
            setModalProdutoAberto(false);
          }}
        />
      )}

      {modalMenuAberto && (
        <MenuModal role={role} lojaId={lojaId} onFechar={() => setModalMenuAberto(false)} />
      )}

      {modalPagamentoAberto && (
        <PagamentoModal
          total={total}
          clienteNome={cliente?.nome ?? "não informado"}
          onFechar={() => setModalPagamentoAberto(false)}
          onConfirmar={confirmarVenda}
        />
      )}

      {ultimaVenda && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-sm rounded-lg border border-slate-300 bg-slate-50 p-6 text-center shadow-2xl">
            <CheckCircle2 className="mx-auto mb-2 h-10 w-10 text-emerald-600" />
            <p className="mb-1 text-lg font-semibold text-slate-900">Venda #{ultimaVenda.id} concluída!</p>
            <p className="mb-6 text-slate-600">Total: R$ {ultimaVenda.total.toFixed(2)}</p>
            <p className="mb-4 text-slate-600">Deseja imprimir o cupom da venda?</p>
            <div className="flex justify-center gap-2">
              <button
                onClick={() => setUltimaVenda(null)}
                className="rounded border border-slate-300 px-4 py-2 text-slate-600 hover:bg-slate-100"
              >
                Não
              </button>
              <button
                onClick={imprimirCupom}
                className="flex items-center gap-2 rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-500"
              >
                <Printer className="h-4 w-4" />
                Sim, imprimir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    {ultimaVenda && <Cupom venda={ultimaVenda} />}
    </>
  );
}
