"use client";

import { AlertCircle, CircleUserRound, Pencil, Plus, Search, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/apiClient";
import { ModalCadastro } from "@/components/ModalCadastro";
import type { Cliente } from "@/lib/types";

const FORM_VAZIO = {
  nome: "",
  cpf_cnpj: "",
  inscricao_estadual: "",
  telefone: "",
  endereco: "",
  cep: "",
  logradouro: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  uf: "",
  codigo_municipio: "",
};

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [busca, setBusca] = useState("");
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<Cliente | null>(null);
  const [form, setForm] = useState(FORM_VAZIO);
  const [erro, setErro] = useState<string | null>(null);

  async function carregar(buscaAlvo = busca) {
    const query = buscaAlvo.trim() ? `?q=${encodeURIComponent(buscaAlvo.trim())}` : "";
    setClientes(await apiFetch<Cliente[]>(`clientes${query}`));
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => carregar(busca), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca]);

  function abrirCriacao() {
    setEditando(null);
    setForm(FORM_VAZIO);
    setErro(null);
    setModalAberto(true);
  }

  function abrirEdicao(cliente: Cliente) {
    setEditando(cliente);
    setForm({
      nome: cliente.nome,
      cpf_cnpj: cliente.cpf_cnpj ?? "",
      inscricao_estadual: cliente.inscricao_estadual ?? "",
      telefone: cliente.telefone ?? "",
      endereco: cliente.endereco ?? "",
      cep: cliente.cep ?? "",
      logradouro: cliente.logradouro ?? "",
      numero: cliente.numero ?? "",
      complemento: cliente.complemento ?? "",
      bairro: cliente.bairro ?? "",
      cidade: cliente.cidade ?? "",
      uf: cliente.uf ?? "",
      codigo_municipio: cliente.codigo_municipio ?? "",
    });
    setErro(null);
    setModalAberto(true);
  }

  function campo(chave: keyof typeof form, valor: string) {
    setForm((atual) => ({ ...atual, [chave]: valor }));
  }

  async function salvar(event: React.FormEvent) {
    event.preventDefault();
    setErro(null);

    const payload = {
      nome: form.nome,
      cpf_cnpj: form.cpf_cnpj || null,
      inscricao_estadual: form.inscricao_estadual || null,
      telefone: form.telefone || null,
      endereco: form.endereco || null,
      cep: form.cep || null,
      logradouro: form.logradouro || null,
      numero: form.numero || null,
      complemento: form.complemento || null,
      bairro: form.bairro || null,
      cidade: form.cidade || null,
      uf: form.uf || null,
      codigo_municipio: form.codigo_municipio || null,
    };

    try {
      if (editando) {
        await apiFetch(`clientes/${editando.id}`, { method: "PUT", body: JSON.stringify(payload) });
      } else {
        await apiFetch("clientes", { method: "POST", body: JSON.stringify(payload) });
      }
      setModalAberto(false);
      await carregar();
    } catch {
      setErro("Não foi possível salvar o cliente.");
    }
  }

  return (
    <div className="max-w-2xl text-slate-900">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Users className="h-5 w-5 text-blue-600" />
          Clientes
        </h2>
        <button
          onClick={abrirCriacao}
          className="flex items-center gap-1.5 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
        >
          <Plus className="h-4 w-4" />
          Cadastrar
        </button>
      </div>

      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome ou CPF/CNPJ..."
          className="w-full rounded border border-slate-300 bg-white py-2 pl-9 pr-3 text-slate-900 outline-none focus:border-blue-500"
        />
      </div>

      <ul className="divide-y divide-slate-200 rounded border border-slate-200">
        {clientes.length === 0 && (
          <li className="px-4 py-8 text-center text-slate-500">
            Nenhum cliente encontrado{busca ? ` para "${busca}"` : ""}.
          </li>
        )}
        {clientes.map((cliente) => (
          <li key={cliente.id} className="flex items-center justify-between px-4 py-3">
            <span className="flex items-center gap-2">
              <CircleUserRound className="h-5 w-5 text-slate-400" />
              {cliente.nome}
            </span>
            <span className="flex items-center gap-3 text-sm text-slate-500">
              {cliente.cpf_cnpj ?? "—"}
              <button
                onClick={() => abrirEdicao(cliente)}
                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                title="Editar"
              >
                <Pencil className="h-4 w-4" />
              </button>
            </span>
          </li>
        ))}
      </ul>

      {modalAberto && (
        <ModalCadastro
          titulo={editando ? "Editar Cliente" : "Novo Cliente"}
          icone={Users}
          onFechar={() => setModalAberto(false)}
        >
          <form onSubmit={salvar}>
            <label className="mb-1 block text-sm text-slate-500">Nome</label>
            <input
              autoFocus
              value={form.nome}
              onChange={(e) => campo("nome", e.target.value)}
              required
              className="mb-3 w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
            />

            <div className="mb-3 grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm text-slate-500">CPF/CNPJ</label>
                <input
                  value={form.cpf_cnpj}
                  onChange={(e) => campo("cpf_cnpj", e.target.value)}
                  className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-500">Telefone</label>
                <input
                  value={form.telefone}
                  onChange={(e) => campo("telefone", e.target.value)}
                  className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <label className="mb-1 block text-sm text-slate-500">Endereço (texto livre)</label>
            <input
              value={form.endereco}
              onChange={(e) => campo("endereco", e.target.value)}
              className="mb-4 w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
            />

            <p className="mb-2 text-sm font-medium text-slate-700">
              Endereço estruturado (só necessário pra emitir NF-e)
            </p>
            <div className="mb-3 grid grid-cols-3 gap-3">
              <div>
                <label className="mb-1 block text-sm text-slate-500">Inscrição Estadual</label>
                <input
                  value={form.inscricao_estadual}
                  onChange={(e) => campo("inscricao_estadual", e.target.value)}
                  className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-500">CEP</label>
                <input
                  value={form.cep}
                  onChange={(e) => campo("cep", e.target.value)}
                  className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-500">Cód. Município (IBGE)</label>
                <input
                  value={form.codigo_municipio}
                  onChange={(e) => campo("codigo_municipio", e.target.value)}
                  className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="mb-3 grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="mb-1 block text-sm text-slate-500">Logradouro</label>
                <input
                  value={form.logradouro}
                  onChange={(e) => campo("logradouro", e.target.value)}
                  className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-500">Número</label>
                <input
                  value={form.numero}
                  onChange={(e) => campo("numero", e.target.value)}
                  className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="mb-4 grid grid-cols-4 gap-3">
              <div>
                <label className="mb-1 block text-sm text-slate-500">Complemento</label>
                <input
                  value={form.complemento}
                  onChange={(e) => campo("complemento", e.target.value)}
                  className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-500">Bairro</label>
                <input
                  value={form.bairro}
                  onChange={(e) => campo("bairro", e.target.value)}
                  className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-500">Cidade</label>
                <input
                  value={form.cidade}
                  onChange={(e) => campo("cidade", e.target.value)}
                  className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-500">UF</label>
                <input
                  maxLength={2}
                  value={form.uf}
                  onChange={(e) => campo("uf", e.target.value.toUpperCase())}
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

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalAberto(false)}
                className="rounded border border-slate-300 px-4 py-2 text-slate-600 hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="flex items-center gap-2 rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-500"
              >
                <Plus className="h-4 w-4" />
                {editando ? "Salvar" : "Cadastrar"}
              </button>
            </div>
          </form>
        </ModalCadastro>
      )}
    </div>
  );
}
