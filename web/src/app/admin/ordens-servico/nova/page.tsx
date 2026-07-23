"use client";

import { AlertCircle, Plus, ScanBarcode, Tag, Trash2, Wrench } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { apiFetch, ApiError } from "@/lib/apiClient";
import { ModalCadastro } from "@/components/ModalCadastro";
import type { Ativo, Cliente, ItemVendavel, Loja, OrdemServico, Produto, Servico } from "@/lib/types";

type ItemOS = {
  chave: string;
  vendavel: ItemVendavel;
  quantidade: number;
  precoUnitario: number;
};

function chaveVendavel(vendavel: ItemVendavel): string {
  return `${vendavel.tipo}-${vendavel.item.id}`;
}

export default function NovaOrdemServicoPage() {
  const router = useRouter();

  const [lojas, setLojas] = useState<Loja[]>([]);
  const [lojaId, setLojaId] = useState<number | null>(null);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [clienteId, setClienteId] = useState<number | null>(null);
  const [ativos, setAtivos] = useState<Ativo[]>([]);
  const [ativoId, setAtivoId] = useState<number | null>(null);

  const [modalClienteAberto, setModalClienteAberto] = useState(false);
  const [novoClienteNome, setNovoClienteNome] = useState("");
  const [novoClienteTelefone, setNovoClienteTelefone] = useState("");
  const [novoClienteCpfCnpj, setNovoClienteCpfCnpj] = useState("");
  const [salvandoCliente, setSalvandoCliente] = useState(false);
  const [erroCliente, setErroCliente] = useState<string | null>(null);

  const [descricaoProblema, setDescricaoProblema] = useState("");
  const [observacoes, setObservacoes] = useState("");

  const [servicosCatalogo, setServicosCatalogo] = useState<Servico[]>([]);
  const [busca, setBusca] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [produtosEncontrados, setProdutosEncontrados] = useState<Produto[]>([]);
  const [itens, setItens] = useState<ItemOS[]>([]);

  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const buscaRef = useRef<HTMLInputElement>(null);

  async function carregarClientes() {
    setClientes(await apiFetch<Cliente[]>("clientes"));
  }

  useEffect(() => {
    apiFetch<Loja[]>("lojas").then((dados) => {
      setLojas(dados);
      setLojaId((atual) => atual ?? dados.find((l) => l.ativo)?.id ?? dados[0]?.id ?? null);
    });
    carregarClientes();
    // Serviço é catálogo pequeno — carrega tudo uma vez e busca client-side
    // pelo mesmo termo do produto, sem round-trip extra por tecla.
    apiFetch<Servico[]>("servicos").then(setServicosCatalogo);
  }, []);

  useEffect(() => {
    setAtivoId(null);
    if (!clienteId) {
      setAtivos([]);
      return;
    }
    apiFetch<Ativo[]>(`ativos?cliente_id=${clienteId}`).then(setAtivos);
  }, [clienteId]);

  // Busca ao vivo (debounced) igual ao PDV — mesmo input serve pro leitor
  // de código de barras (Enter) e pra digitação normal.
  useEffect(() => {
    const termo = busca.trim();
    if (termo.length < 2) {
      setProdutosEncontrados([]);
      return;
    }
    const timer = setTimeout(() => {
      apiFetch<Produto[]>(`produtos?q=${encodeURIComponent(termo)}`).then(setProdutosEncontrados);
    }, 250);
    return () => clearTimeout(timer);
  }, [busca]);

  const servicosEncontrados =
    busca.trim().length < 2
      ? []
      : servicosCatalogo.filter((s) => s.descricao.toLowerCase().includes(busca.trim().toLowerCase()));

  function adicionarItem(vendavel: ItemVendavel) {
    const chave = chaveVendavel(vendavel);
    setItens((atual) => {
      const existente = atual.find((item) => item.chave === chave);
      if (existente) {
        return atual.map((item) => (item.chave === chave ? { ...item, quantidade: item.quantidade + 1 } : item));
      }
      return [...atual, { chave, vendavel, quantidade: 1, precoUnitario: Number(vendavel.item.preco_venda ?? 0) }];
    });
    setBusca("");
    setProdutosEncontrados([]);
    buscaRef.current?.focus();
  }

  // Enter — mesmo comportamento do PDV: bipe/código exato ou nome único
  // adiciona direto, mais de um resultado só deixa o dropdown ao vivo aberto.
  async function buscarItem() {
    const termo = busca.trim();
    if (!termo) return;

    setBuscando(true);
    try {
      const produtos = await apiFetch<Produto[]>(`produtos?q=${encodeURIComponent(termo)}`);
      const exato = produtos.find((p) => p.codigo_barras === termo || p.codigo_interno === termo);
      const servicosAtuais = servicosCatalogo.filter((s) => s.descricao.toLowerCase().includes(termo.toLowerCase()));

      if (exato) {
        adicionarItem({ tipo: "produto", item: exato });
      } else if (produtos.length + servicosAtuais.length === 1) {
        if (produtos.length === 1) {
          adicionarItem({ tipo: "produto", item: produtos[0] });
        } else {
          adicionarItem({ tipo: "servico", item: servicosAtuais[0] });
        }
      } else {
        setProdutosEncontrados(produtos);
      }
    } catch {
      setErro("Não foi possível buscar produtos/serviços.");
    } finally {
      setBuscando(false);
    }
  }

  function removerItem(chave: string) {
    setItens((atual) => atual.filter((item) => item.chave !== chave));
  }

  function atualizarItem(chave: string, campo: "quantidade" | "precoUnitario", valor: number) {
    setItens((atual) => atual.map((item) => (item.chave === chave ? { ...item, [campo]: Math.max(0, valor) } : item)));
  }

  const total = itens.reduce((soma, item) => soma + item.quantidade * item.precoUnitario, 0);

  async function salvarNovoCliente(event: React.FormEvent) {
    event.preventDefault();
    setErroCliente(null);
    setSalvandoCliente(true);

    try {
      const cliente = await apiFetch<Cliente>("clientes", {
        method: "POST",
        body: JSON.stringify({
          nome: novoClienteNome,
          telefone: novoClienteTelefone || null,
          cpf_cnpj: novoClienteCpfCnpj || null,
        }),
      });

      await carregarClientes();
      setClienteId(cliente.id);
      setModalClienteAberto(false);
      setNovoClienteNome("");
      setNovoClienteTelefone("");
      setNovoClienteCpfCnpj("");
    } catch (e) {
      setErroCliente(e instanceof ApiError ? e.message : "Não foi possível cadastrar o cliente.");
    } finally {
      setSalvandoCliente(false);
    }
  }

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
            produto_id: item.vendavel.tipo === "produto" ? item.vendavel.item.id : null,
            servico_id: item.vendavel.tipo === "servico" ? item.vendavel.item.id : null,
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
          <div className="flex gap-1">
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
            <button
              type="button"
              onClick={() => {
                setErroCliente(null);
                setModalClienteAberto(true);
              }}
              title="Não achou? Cadastrar cliente novo"
              className="shrink-0 rounded border border-slate-300 bg-white px-2 text-slate-600 hover:bg-slate-100"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div>
          <label className="mb-1 flex items-center gap-1 text-sm text-slate-500">
            <Tag className="h-3.5 w-3.5" />
            Item do cliente (opcional)
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
        <label className="mb-1 block text-sm text-slate-500">Descrição do problema (opcional)</label>
        <textarea
          value={descricaoProblema}
          onChange={(e) => setDescricaoProblema(e.target.value)}
          rows={2}
          className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
        />
      </div>

      <div className="relative mb-3">
        <label className="mb-1 flex items-center gap-1 text-sm text-slate-500">
          <ScanBarcode className="h-3.5 w-3.5" />
          Produto ou serviço — bipe o código ou digite pra buscar
        </label>
        <input
          ref={buscaRef}
          autoFocus
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && buscarItem()}
          placeholder="Bipe o código de barras ou digite a descrição..."
          className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
        />
        {buscando && <p className="mt-1 text-sm text-slate-500">Buscando...</p>}
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
                    step="0.001"
                    value={item.quantidade}
                    onChange={(e) => atualizarItem(item.chave, "quantidade", Number(e.target.value) || 0)}
                    className="w-20 rounded border border-slate-300 bg-white px-2 py-1"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    step="0.01"
                    value={item.precoUnitario}
                    onChange={(e) => atualizarItem(item.chave, "precoUnitario", Number(e.target.value) || 0)}
                    className="w-24 rounded border border-slate-300 bg-white px-2 py-1"
                  />
                </td>
                <td className="px-3 py-2">R$ {(item.quantidade * item.precoUnitario).toFixed(2)}</td>
                <td className="px-3 py-2">
                  <button
                    onClick={() => removerItem(item.chave)}
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

      {modalClienteAberto && (
        <ModalCadastro titulo="Novo Cliente" icone={Plus} onFechar={() => setModalClienteAberto(false)}>
          <form onSubmit={salvarNovoCliente}>
            <label className="mb-1 block text-sm text-slate-500">Nome</label>
            <input
              autoFocus
              value={novoClienteNome}
              onChange={(e) => setNovoClienteNome(e.target.value)}
              required
              className="mb-3 w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
            />

            <div className="mb-4 grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm text-slate-500">Telefone (opcional)</label>
                <input
                  value={novoClienteTelefone}
                  onChange={(e) => setNovoClienteTelefone(e.target.value)}
                  className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-500">CPF/CNPJ (opcional)</label>
                <input
                  value={novoClienteCpfCnpj}
                  onChange={(e) => setNovoClienteCpfCnpj(e.target.value)}
                  className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <p className="mb-4 text-xs text-slate-400">
              Endereço completo não é obrigatório aqui — só é necessário se for emitir NF-e pra esse cliente depois
              (dá pra completar o cadastro em Clientes).
            </p>

            {erroCliente && (
              <p className="mb-4 flex items-center gap-1.5 text-sm text-red-600">
                <AlertCircle className="h-4 w-4" />
                {erroCliente}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalClienteAberto(false)}
                className="rounded border border-slate-300 px-4 py-2 text-slate-600 hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={salvandoCliente}
                className="flex items-center gap-2 rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-500 disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                {salvandoCliente ? "Salvando..." : "Cadastrar"}
              </button>
            </div>
          </form>
        </ModalCadastro>
      )}
    </div>
  );
}
