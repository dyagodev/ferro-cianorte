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
  ShoppingCart,
  Trash2,
  UserRound,
  XCircle,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "@/lib/apiClient";
import { imprimir } from "@/lib/imprimir";
import type { Cliente, ItemVendavel, Loja, Produto, Servico } from "@/lib/types";
import ClienteModal from "./cliente-modal";
import Cupom, { type VendaConcluida } from "./cupom";
import MenuModal from "./menu-modal";
import PagamentoModal from "./pagamento-modal";
import ProdutoModal from "./produto-modal";

type TipoDesconto = "valor" | "percentual";

type ItemCarrinho = {
  chave: string;
  vendavel: ItemVendavel;
  quantidade: number;
  precoVendido: number;
};

function chaveVendavel(vendavel: ItemVendavel): string {
  return `${vendavel.tipo}-${vendavel.item.id}`;
}

export default function PdvScreen({
  role,
  nomeUsuario,
  lojaIdSessao,
  possuiSpedyConfigurado,
}: {
  role: "admin" | "vendedor";
  nomeUsuario: string;
  lojaIdSessao: number | null;
  possuiSpedyConfigurado: boolean;
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
  const [modalCancelarAberto, setModalCancelarAberto] = useState(false);
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [lojaSelecionadaId, setLojaSelecionadaId] = useState<number | null>(null);
  const [ultimaVenda, setUltimaVenda] = useState<VendaConcluida | null>(null);
  const [descontoTipo, setDescontoTipo] = useState<TipoDesconto>("valor");
  const [descontoTexto, setDescontoTexto] = useState("0");
  const [quantidadeEditando, setQuantidadeEditando] = useState<Record<string, string>>({});
  const [servicosCatalogo, setServicosCatalogo] = useState<Servico[]>([]);
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
    // Serviço é catálogo pequeno — carrega tudo uma vez e busca client-side
    // pelo mesmo termo do produto, sem round-trip extra por tecla.
    apiFetch<Servico[]>("servicos").then(setServicosCatalogo);
  }, [role]);

  const servicosResultados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (termo.length < 2) return [];
    return servicosCatalogo.filter((s) => s.descricao.toLowerCase().includes(termo));
  }, [busca, servicosCatalogo]);

  const lojaId = role === "admin" ? lojaSelecionadaId : lojaIdSessao;
  const lojaNome = lojas.find((loja) => loja.id === lojaId)?.nome ?? "DM Nexus";

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
      } else if (event.key === "F8") {
        event.preventDefault();
        if (carrinho.length > 0) setModalCancelarAberto(true);
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
      const totalResultados = produtos.length + servicosResultados.length;

      if (totalResultados === 1) {
        if (produtos.length === 1) {
          adicionarAoCarrinho({ tipo: "produto", item: produtos[0] });
        } else {
          adicionarAoCarrinho({ tipo: "servico", item: servicosResultados[0] });
        }
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

  function adicionarAoCarrinho(vendavel: ItemVendavel) {
    const chave = chaveVendavel(vendavel);
    setCarrinho((atual) => {
      const existente = atual.find((item) => item.chave === chave);
      if (existente) {
        return atual.map((item) => (item.chave === chave ? { ...item, quantidade: item.quantidade + 1 } : item));
      }
      return [...atual, { chave, vendavel, quantidade: 1, precoVendido: Number(vendavel.item.preco_venda) }];
    });
    setResultados([]);
    buscaRef.current?.focus();
  }

  function atualizarQuantidade(chave: string, quantidade: number) {
    if (!Number.isFinite(quantidade) || quantidade <= 0) {
      return;
    }
    setCarrinho((atual) => atual.map((item) => (item.chave === chave ? { ...item, quantidade } : item)));
  }

  function atualizarPrecoVendido(chave: string, preco: number) {
    setCarrinho((atual) =>
      atual.map((item) => (item.chave === chave ? { ...item, precoVendido: Math.max(0, preco) } : item)),
    );
  }

  function removerItem(chave: string) {
    setCarrinho((atual) => atual.filter((item) => item.chave !== chave));
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  async function confirmarVenda(
    pagamentos: { forma_pagamento: string; valor: number }[],
    emitirNotaFiscal: boolean,
  ) {
    const venda = await apiFetch<{ id: number; created_at: string }>("vendas", {
      method: "POST",
      body: JSON.stringify({
        cliente_id: cliente?.id ?? null,
        loja_id: role === "admin" ? lojaId : undefined,
        desconto: descontoReais,
        itens: carrinho.map((item) => ({
          produto_id: item.vendavel.tipo === "produto" ? item.vendavel.item.id : null,
          servico_id: item.vendavel.tipo === "servico" ? item.vendavel.item.id : null,
          quantidade: item.quantidade,
          preco_unitario: item.precoVendido,
        })),
        pagamentos,
        emitir_nota_fiscal: emitirNotaFiscal,
      }),
    });

    setUltimaVenda({
      id: venda.id,
      dataHora: venda.created_at,
      lojaNome,
      vendedorNome: nomeUsuario,
      clienteNome: cliente?.nome ?? "não informado",
      itens: carrinho.map((item) => ({
        descricao: item.vendavel.item.descricao,
        quantidade: item.quantidade,
        precoOriginal: Number(item.vendavel.item.preco_venda),
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

  function cancelarOperacao() {
    setCarrinho([]);
    setCliente(null);
    setDescontoTexto("0");
    setDescontoTipo("valor");
    setBusca("");
    setResultados([]);
    setErro(null);
    setModalCancelarAberto(false);
    buscaRef.current?.focus();
  }

  async function imprimirCupom() {
    await imprimir();
    setUltimaVenda(null);
  }

  return (
    <>
    <div className="relative flex flex-1 flex-col bg-white print:hidden">
      <Image
        src="/logo-dm-nexus.png"
        alt=""
        width={1228}
        height={235}
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 w-[840px] max-w-[85%] -translate-x-1/2 -translate-y-1/2 select-none opacity-[0.035]"
      />
      <header className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2">
        <Image src="/logo-dm-nexus.png" alt="DM Nexus" width={1228} height={235} className="h-9 w-auto" priority />
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

          {(resultados.length > 0 || servicosResultados.length > 0) && (
            <ul className="absolute z-10 mt-1 w-full rounded border border-slate-300 bg-slate-50 shadow-xl">
              {servicosResultados.map((servico) => (
                <li key={`servico-${servico.id}`}>
                  <button
                    onClick={() => adicionarAoCarrinho({ tipo: "servico", item: servico })}
                    className="flex w-full items-center justify-between px-4 py-2 text-left text-slate-900 hover:bg-slate-100"
                  >
                    <span>
                      {servico.descricao}
                      <span className="ml-2 rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700">serviço</span>
                    </span>
                    <span className="text-slate-500">R$ {Number(servico.preco_venda).toFixed(2)}</span>
                  </button>
                </li>
              ))}
              {resultados.map((produto) => (
                <li key={`produto-${produto.id}`}>
                  <button
                    onClick={() => adicionarAoCarrinho({ tipo: "produto", item: produto })}
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
              <tr className="divide-x divide-slate-200">
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
                <tr key={item.chave} className="divide-x divide-slate-200 border-t border-slate-200">
                  <td className="px-3 py-2">
                    {item.vendavel.item.descricao}
                    {item.vendavel.tipo === "servico" && (
                      <span className="ml-2 rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700">serviço</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={0}
                      step="1"
                      value={quantidadeEditando[item.chave] ?? String(item.quantidade)}
                      onChange={(e) => {
                        const bruto = e.target.value;
                        setQuantidadeEditando((atual) => ({ ...atual, [item.chave]: bruto }));
                        const num = Number(bruto);
                        if (bruto !== "" && Number.isFinite(num) && num > 0) {
                          atualizarQuantidade(item.chave, num);
                        }
                      }}
                      onBlur={() => {
                        setQuantidadeEditando((atual) => {
                          const bruto = atual[item.chave];
                          const num = Number(bruto);
                          if (bruto === "" || !Number.isFinite(num) || num <= 0) {
                            atualizarQuantidade(item.chave, 1);
                          }
                          const { [item.chave]: _, ...resto } = atual;
                          return resto;
                        });
                      }}
                      className="w-20 rounded border border-slate-300 bg-white px-2 py-1"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={item.precoVendido}
                      onChange={(e) => atualizarPrecoVendido(item.chave, Number(e.target.value))}
                      className={`w-24 rounded border px-2 py-1 ${
                        item.precoVendido !== Number(item.vendavel.item.preco_venda)
                          ? "border-amber-400 bg-amber-50"
                          : "border-slate-300 bg-white"
                      }`}
                    />
                    {item.precoVendido !== Number(item.vendavel.item.preco_venda) && (
                      <p className="text-xs text-slate-500 line-through">
                        R$ {Number(item.vendavel.item.preco_venda).toFixed(2)}
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-2">{(item.quantidade * item.precoVendido).toFixed(2)}</td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => removerItem(item.chave)}
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
            <button
              onClick={() => carrinho.length > 0 && setModalCancelarAberto(true)}
              disabled={carrinho.length === 0}
              className="flex items-center gap-1.5 text-red-600 hover:text-red-700 disabled:opacity-50"
            >
              <XCircle className="h-4 w-4" />
              F8 - Cancelar Operação
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
          onSelecionar={(vendavel) => {
            adicionarAoCarrinho(vendavel);
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
          possuiSpedyConfigurado={possuiSpedyConfigurado}
          onFechar={() => setModalPagamentoAberto(false)}
          onConfirmar={confirmarVenda}
        />
      )}

      {modalCancelarAberto && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-sm rounded-lg border border-slate-300 bg-slate-50 p-6 text-center shadow-2xl">
            <XCircle className="mx-auto mb-2 h-10 w-10 text-red-600" />
            <p className="mb-1 text-lg font-semibold text-slate-900">Cancelar operação?</p>
            <p className="mb-6 text-slate-600">
              Todos os itens do carrinho, cliente e desconto serão perdidos.
            </p>
            <div className="flex justify-center gap-2">
              <button
                onClick={() => setModalCancelarAberto(false)}
                className="rounded border border-slate-300 px-4 py-2 text-slate-600 hover:bg-slate-100"
              >
                Não
              </button>
              <button
                onClick={cancelarOperacao}
                className="flex items-center gap-2 rounded bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-500"
              >
                <XCircle className="h-4 w-4" />
                Sim, cancelar
              </button>
            </div>
          </div>
        </div>
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
