"use client";

import { AlertCircle, Pencil, Plus, ShieldCheck, UserRound, UsersRound } from "lucide-react";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/apiClient";
import { ModalCadastro } from "@/components/ModalCadastro";
import type { Loja } from "@/lib/types";

type Funcionario = { id: number; name: string; email: string; role: "admin" | "vendedor"; loja_id: number | null };

const FORM_VAZIO = {
  name: "",
  email: "",
  password: "",
  role: "vendedor" as "admin" | "vendedor",
  loja_id: "",
};

export default function FuncionariosPage() {
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<Funcionario | null>(null);
  const [form, setForm] = useState(FORM_VAZIO);
  const [erro, setErro] = useState<string | null>(null);

  async function carregar() {
    const [funcionariosResp, lojasResp] = await Promise.all([
      apiFetch<Funcionario[]>("funcionarios"),
      apiFetch<Loja[]>("lojas"),
    ]);
    setFuncionarios(funcionariosResp);
    setLojas(lojasResp);
  }

  useEffect(() => {
    carregar();
  }, []);

  function campo(chave: keyof typeof form, valor: string) {
    setForm((atual) => ({ ...atual, [chave]: valor }));
  }

  function abrirCriacao() {
    setEditando(null);
    setForm(FORM_VAZIO);
    setErro(null);
    setModalAberto(true);
  }

  function abrirEdicao(funcionario: Funcionario) {
    setEditando(funcionario);
    setForm({
      name: funcionario.name,
      email: funcionario.email,
      password: "",
      role: funcionario.role,
      loja_id: funcionario.loja_id ? String(funcionario.loja_id) : "",
    });
    setErro(null);
    setModalAberto(true);
  }

  async function salvar(event: React.FormEvent) {
    event.preventDefault();
    setErro(null);

    const payload: Record<string, unknown> = {
      name: form.name,
      email: form.email,
      role: form.role,
      loja_id: form.role === "vendedor" ? Number(form.loja_id) : null,
    };
    if (form.password) {
      payload.password = form.password;
    }

    try {
      if (editando) {
        await apiFetch(`funcionarios/${editando.id}`, { method: "PUT", body: JSON.stringify(payload) });
      } else {
        await apiFetch("funcionarios", { method: "POST", body: JSON.stringify(payload) });
      }
      setModalAberto(false);
      await carregar();
    } catch {
      setErro("Não foi possível salvar o funcionário. Verifique os dados (e-mail único, loja obrigatória para vendedor).");
    }
  }

  return (
    <div className="max-w-3xl text-slate-900">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <UsersRound className="h-5 w-5 text-blue-600" />
          Funcionários
        </h2>
        <button
          onClick={abrirCriacao}
          className="flex items-center gap-1.5 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
        >
          <Plus className="h-4 w-4" />
          Cadastrar
        </button>
      </div>

      <ul className="divide-y divide-slate-200 rounded border border-slate-200">
        {funcionarios.map((funcionario) => (
          <li key={funcionario.id} className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              {funcionario.role === "admin" ? (
                <ShieldCheck className="h-5 w-5 text-blue-600" />
              ) : (
                <UserRound className="h-5 w-5 text-slate-400" />
              )}
              <div>
                <p className="font-medium">{funcionario.name}</p>
                <p className="text-sm text-slate-500">{funcionario.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-500">
                {funcionario.role === "admin" ? "Admin" : `Vendedor — ${lojas.find((l) => l.id === funcionario.loja_id)?.nome ?? "?"}`}
              </span>
              <button
                onClick={() => abrirEdicao(funcionario)}
                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                title="Editar"
              >
                <Pencil className="h-4 w-4" />
              </button>
            </div>
          </li>
        ))}
      </ul>

      {modalAberto && (
        <ModalCadastro
          titulo={editando ? "Editar Funcionário" : "Novo Funcionário"}
          icone={UsersRound}
          onFechar={() => setModalAberto(false)}
        >
          <form onSubmit={salvar}>
            <label className="mb-1 block text-sm text-slate-500">Nome</label>
            <input
              autoFocus
              value={form.name}
              onChange={(e) => campo("name", e.target.value)}
              required
              className="mb-3 w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
            />

            <label className="mb-1 block text-sm text-slate-500">E-mail</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => campo("email", e.target.value)}
              required
              className="mb-3 w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
            />

            <label className="mb-1 block text-sm text-slate-500">
              Senha{editando ? " (deixe em branco pra manter a atual)" : ""}
            </label>
            <input
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={(e) => campo("password", e.target.value)}
              required={!editando}
              className="mb-3 w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
            />

            <label className="mb-1 block text-sm text-slate-500">Papel</label>
            <select
              value={form.role}
              onChange={(e) => campo("role", e.target.value)}
              className="mb-3 w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
            >
              <option value="vendedor">Vendedor</option>
              <option value="admin">Admin</option>
            </select>

            {form.role === "vendedor" && (
              <>
                <label className="mb-1 block text-sm text-slate-500">Loja</label>
                <select
                  value={form.loja_id}
                  onChange={(e) => campo("loja_id", e.target.value)}
                  required
                  className="mb-4 w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                >
                  <option value="">Selecione...</option>
                  {lojas.map((loja) => (
                    <option key={loja.id} value={loja.id}>
                      {loja.nome}
                    </option>
                  ))}
                </select>
              </>
            )}

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
