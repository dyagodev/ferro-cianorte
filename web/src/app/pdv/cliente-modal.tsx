"use client";

import { CircleUserRound, Search, UserPlus, UserRoundSearch, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/apiClient";
import type { Cliente } from "@/lib/types";

export default function ClienteModal({
  onFechar,
  onSelecionar,
}: {
  onFechar: () => void;
  onSelecionar: (cliente: Cliente | null) => void;
}) {
  const [busca, setBusca] = useState("");
  const [resultados, setResultados] = useState<Cliente[]>([]);
  const [buscou, setBuscou] = useState(false);
  const [cadastrando, setCadastrando] = useState(false);
  const [nome, setNome] = useState("");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [telefone, setTelefone] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const termo = busca.trim();
    if (!termo) {
      setResultados([]);
      setBuscou(false);
      return;
    }
    setBuscou(false);
    const timer = setTimeout(() => {
      apiFetch<Cliente[]>(`clientes?q=${encodeURIComponent(termo)}`).then((dados) => {
        setResultados(dados);
        setBuscou(true);
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [busca]);

  function abrirCadastro() {
    setNome(busca);
    setCadastrando(true);
    setErro(null);
  }

  async function cadastrarCliente(event: React.FormEvent) {
    event.preventDefault();
    setSalvando(true);
    setErro(null);

    try {
      const novo = await apiFetch<Cliente>("clientes", {
        method: "POST",
        body: JSON.stringify({ nome, cpf_cnpj: cpfCnpj || null, telefone: telefone || null }),
      });
      onSelecionar(novo);
    } catch {
      setErro("Não foi possível cadastrar o cliente. Confira o nome informado.");
    } finally {
      setSalvando(false);
    }
  }

  if (cadastrando) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black/60" onKeyDown={(e) => e.key === "Escape" && onFechar()}>
        <form
          onSubmit={cadastrarCliente}
          className="w-full max-w-md rounded-lg border border-slate-300 bg-slate-50 p-6 shadow-2xl"
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-xl font-semibold text-slate-900">
              <UserPlus className="h-5 w-5 text-blue-600" />
              Novo Cliente
            </h2>
            <button type="button" onClick={onFechar} className="flex items-center gap-1 text-slate-500 hover:text-slate-900">
              <X className="h-4 w-4" />
              Esc - Fechar
            </button>
          </div>

          <label className="mb-1 block text-sm text-slate-500">Nome</label>
          <input
            autoFocus
            required
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="mb-3 w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
          />

          <label className="mb-1 block text-sm text-slate-500">CPF/CNPJ (opcional)</label>
          <input
            value={cpfCnpj}
            onChange={(e) => setCpfCnpj(e.target.value)}
            className="mb-3 w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
          />

          <label className="mb-1 block text-sm text-slate-500">Telefone (opcional)</label>
          <input
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
            className="mb-4 w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
          />

          {erro && <p className="mb-4 text-sm text-red-600">{erro}</p>}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setCadastrando(false)}
              className="rounded border border-slate-300 px-4 py-2 text-slate-600 hover:bg-slate-100"
            >
              Voltar
            </button>
            <button
              type="submit"
              disabled={salvando}
              className="flex items-center gap-2 rounded bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
            >
              <UserPlus className="h-4 w-4" />
              {salvando ? "Salvando..." : "Salvar e selecionar"}
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/60" onKeyDown={(e) => e.key === "Escape" && onFechar()}>
      <div className="w-full max-w-md rounded-lg border border-slate-300 bg-slate-50 p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-xl font-semibold text-slate-900">
            <UserRoundSearch className="h-5 w-5 text-blue-600" />
            F10 - Cliente
          </h2>
          <button onClick={onFechar} className="flex items-center gap-1 text-slate-500 hover:text-slate-900">
            <X className="h-4 w-4" />
            Esc - Fechar
          </button>
        </div>

        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            ref={inputRef}
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome ou CPF/CNPJ..."
            className="w-full rounded border border-slate-300 bg-white py-2 pl-9 pr-3 text-slate-900 outline-none focus:border-blue-500"
          />
        </div>

        <button
          onClick={() => onSelecionar(null)}
          className="mb-2 w-full rounded border border-slate-300 px-3 py-2 text-left text-slate-600 hover:bg-slate-100"
        >
          Não informado
        </button>

        {buscou && resultados.length === 0 ? (
          <div className="rounded border border-dashed border-slate-300 px-3 py-4 text-center">
            <p className="mb-2 text-sm text-slate-500">Nenhum cliente encontrado para &quot;{busca}&quot;.</p>
            <button
              onClick={abrirCadastro}
              className="flex items-center gap-1.5 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 mx-auto"
            >
              <UserPlus className="h-4 w-4" />
              Cadastrar novo cliente
            </button>
          </div>
        ) : (
          <ul className="max-h-64 divide-y divide-slate-200 overflow-auto rounded border border-slate-200">
            {resultados.map((cliente) => (
              <li key={cliente.id}>
                <button
                  onClick={() => onSelecionar(cliente)}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-slate-900 hover:bg-slate-100"
                >
                  <span className="flex items-center gap-2">
                    <CircleUserRound className="h-4 w-4 text-slate-400" />
                    {cliente.nome}
                  </span>
                  <span className="text-sm text-slate-500">{cliente.cpf_cnpj ?? ""}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {resultados.length > 0 && (
          <button
            onClick={abrirCadastro}
            className="mt-3 flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700"
          >
            <UserPlus className="h-4 w-4" />
            Cadastrar novo cliente
          </button>
        )}
      </div>
    </div>
  );
}
