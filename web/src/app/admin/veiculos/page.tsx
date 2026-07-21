"use client";

import { AlertCircle, Pencil, Plus, Search, Truck } from "lucide-react";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/apiClient";
import { ModalCadastro } from "@/components/ModalCadastro";
import type { Veiculo } from "@/lib/types";

const TIPOS_RODADO: Record<string, string> = {
  "01": "Truck",
  "02": "Toco",
  "03": "Cavalo Mecânico",
  "04": "VAN",
  "05": "Utilitário",
  "06": "Outros",
};

const TIPOS_CARROCERIA: Record<string, string> = {
  "00": "Não aplicável",
  "01": "Aberta",
  "02": "Fechada/Baú",
  "03": "Granelera",
  "04": "Porta Container",
  "05": "Sider",
};

const FORM_VAZIO = {
  placa: "",
  renavam: "",
  tara_kg: "",
  capacidade_kg: "",
  capacidade_m3: "",
  tipo_rodado: "01",
  tipo_carroceria: "00",
  uf: "",
  tipo: "tracao" as "tracao" | "reboque",
};

export default function VeiculosPage() {
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [busca, setBusca] = useState("");
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<Veiculo | null>(null);
  const [form, setForm] = useState(FORM_VAZIO);
  const [erro, setErro] = useState<string | null>(null);

  async function carregar() {
    setVeiculos(await apiFetch<Veiculo[]>("veiculos"));
  }

  useEffect(() => {
    carregar();
  }, []);

  const filtrados = veiculos.filter((v) => v.placa.toLowerCase().includes(busca.trim().toLowerCase()));

  function campo(chave: keyof typeof form, valor: string) {
    setForm((atual) => ({ ...atual, [chave]: valor }));
  }

  function abrirCriacao() {
    setEditando(null);
    setForm(FORM_VAZIO);
    setErro(null);
    setModalAberto(true);
  }

  function abrirEdicao(veiculo: Veiculo) {
    setEditando(veiculo);
    setForm({
      placa: veiculo.placa,
      renavam: veiculo.renavam ?? "",
      tara_kg: String(veiculo.tara_kg),
      capacidade_kg: veiculo.capacidade_kg ? String(veiculo.capacidade_kg) : "",
      capacidade_m3: veiculo.capacidade_m3 ? String(veiculo.capacidade_m3) : "",
      tipo_rodado: veiculo.tipo_rodado ?? "01",
      tipo_carroceria: veiculo.tipo_carroceria ?? "00",
      uf: veiculo.uf ?? "",
      tipo: veiculo.tipo,
    });
    setErro(null);
    setModalAberto(true);
  }

  async function salvar(event: React.FormEvent) {
    event.preventDefault();
    setErro(null);

    const payload = {
      placa: form.placa.toUpperCase(),
      renavam: form.renavam || null,
      tara_kg: Number(form.tara_kg) || 0,
      capacidade_kg: form.capacidade_kg ? Number(form.capacidade_kg) : null,
      capacidade_m3: form.capacidade_m3 ? Number(form.capacidade_m3) : null,
      tipo_rodado: form.tipo_rodado,
      tipo_carroceria: form.tipo_carroceria,
      uf: form.uf || null,
      tipo: form.tipo,
    };

    try {
      if (editando) {
        await apiFetch(`veiculos/${editando.id}`, { method: "PUT", body: JSON.stringify(payload) });
      } else {
        await apiFetch("veiculos", { method: "POST", body: JSON.stringify(payload) });
      }
      setModalAberto(false);
      await carregar();
    } catch {
      setErro("Não foi possível salvar o veículo.");
    }
  }

  async function desativar(veiculo: Veiculo) {
    if (!window.confirm(`Desativar o veículo "${veiculo.placa}"?`)) return;
    try {
      await apiFetch(`veiculos/${veiculo.id}`, { method: "DELETE" });
      await carregar();
    } catch {
      setErro("Não foi possível desativar o veículo.");
    }
  }

  return (
    <div className="max-w-3xl text-slate-900">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Truck className="h-5 w-5 text-blue-600" />
          Veículos
        </h2>
        <button
          onClick={abrirCriacao}
          className="flex items-center gap-1.5 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
        >
          <Plus className="h-4 w-4" />
          Cadastrar
        </button>
      </div>

      <p className="mb-4 text-sm text-slate-500">
        Veículos de tração (obrigatório no manifesto) e reboques/carretas (opcionais) — usados na emissão de MDF-e.
      </p>

      <div className="relative mb-3 max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por placa..."
          className="w-full rounded border border-slate-300 bg-white py-2 pl-9 pr-3 text-slate-900 outline-none focus:border-blue-500"
        />
      </div>

      <div className="overflow-auto rounded border border-slate-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr className="divide-x divide-slate-200">
              <th className="px-3 py-2">Placa</th>
              <th className="px-3 py-2">Tipo</th>
              <th className="px-3 py-2">Rodado</th>
              <th className="px-3 py-2">Carroceria</th>
              <th className="px-3 py-2">Tara (kg)</th>
              <th className="px-3 py-2">UF</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {filtrados.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-slate-500">
                  Nenhum veículo encontrado{busca ? ` para "${busca}"` : ""}.
                </td>
              </tr>
            )}
            {filtrados.map((veiculo) => (
              <tr key={veiculo.id} className="divide-x divide-slate-200 border-t border-slate-200">
                <td className="px-3 py-2 font-medium">{veiculo.placa}</td>
                <td className="px-3 py-2">
                  <span
                    className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                      veiculo.tipo === "reboque" ? "bg-purple-100 text-purple-700" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {veiculo.tipo === "reboque" ? "Reboque" : "Tração"}
                  </span>
                </td>
                <td className="px-3 py-2 text-slate-500">{TIPOS_RODADO[veiculo.tipo_rodado ?? ""] ?? "—"}</td>
                <td className="px-3 py-2 text-slate-500">{TIPOS_CARROCERIA[veiculo.tipo_carroceria ?? ""] ?? "—"}</td>
                <td className="px-3 py-2">{veiculo.tara_kg}</td>
                <td className="px-3 py-2 text-slate-500">{veiculo.uf ?? "—"}</td>
                <td className="px-3 py-2">
                  <button
                    onClick={() => abrirEdicao(veiculo)}
                    className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                    title="Editar"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalAberto && (
        <ModalCadastro
          titulo={editando ? "Editar Veículo" : "Novo Veículo"}
          icone={Truck}
          onFechar={() => setModalAberto(false)}
        >
          <form onSubmit={salvar}>
            <div className="mb-3 grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm text-slate-500">Placa</label>
                <input
                  autoFocus
                  value={form.placa}
                  onChange={(e) => campo("placa", e.target.value.toUpperCase())}
                  required
                  className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-500">RENAVAM</label>
                <input
                  value={form.renavam}
                  onChange={(e) => campo("renavam", e.target.value)}
                  className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <label className="mb-1 block text-sm text-slate-500">Tipo</label>
            <div className="mb-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => campo("tipo", "tracao")}
                className={`rounded border px-3 py-2 text-sm ${
                  form.tipo === "tracao"
                    ? "border-blue-500 bg-blue-600 text-white"
                    : "border-slate-300 bg-white text-slate-600 hover:bg-slate-100"
                }`}
              >
                Tração
              </button>
              <button
                type="button"
                onClick={() => campo("tipo", "reboque")}
                className={`rounded border px-3 py-2 text-sm ${
                  form.tipo === "reboque"
                    ? "border-blue-500 bg-blue-600 text-white"
                    : "border-slate-300 bg-white text-slate-600 hover:bg-slate-100"
                }`}
              >
                Reboque
              </button>
            </div>

            <div className="mb-3 grid grid-cols-3 gap-3">
              <div>
                <label className="mb-1 block text-sm text-slate-500">Tara (kg)</label>
                <input
                  type="number"
                  value={form.tara_kg}
                  onChange={(e) => campo("tara_kg", e.target.value)}
                  required
                  className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-500">Capacidade (kg)</label>
                <input
                  type="number"
                  value={form.capacidade_kg}
                  onChange={(e) => campo("capacidade_kg", e.target.value)}
                  className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-500">Capacidade (m³)</label>
                <input
                  type="number"
                  value={form.capacidade_m3}
                  onChange={(e) => campo("capacidade_m3", e.target.value)}
                  className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="mb-4 grid grid-cols-3 gap-3">
              {form.tipo === "tracao" && (
                <div>
                  <label className="mb-1 block text-sm text-slate-500">Tipo de rodado</label>
                  <select
                    value={form.tipo_rodado}
                    onChange={(e) => campo("tipo_rodado", e.target.value)}
                    className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                  >
                    {Object.entries(TIPOS_RODADO).map(([valor, rotulo]) => (
                      <option key={valor} value={valor}>
                        {rotulo}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="mb-1 block text-sm text-slate-500">Carroceria</label>
                <select
                  value={form.tipo_carroceria}
                  onChange={(e) => campo("tipo_carroceria", e.target.value)}
                  className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                >
                  {Object.entries(TIPOS_CARROCERIA).map(([valor, rotulo]) => (
                    <option key={valor} value={valor}>
                      {rotulo}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-500">UF (licenciamento)</label>
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

            <div className="flex justify-between gap-2">
              {editando && (
                <button
                  type="button"
                  onClick={() => {
                    setModalAberto(false);
                    desativar(editando);
                  }}
                  className="rounded border border-red-300 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  Desativar
                </button>
              )}
              <div className="ml-auto flex gap-2">
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
            </div>
          </form>
        </ModalCadastro>
      )}
    </div>
  );
}
