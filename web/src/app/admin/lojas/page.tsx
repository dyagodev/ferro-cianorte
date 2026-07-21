"use client";

import { AlertCircle, MapPin, Pencil, Plus, Store } from "lucide-react";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/apiClient";
import { BuscaMunicipio } from "@/components/BuscaMunicipio";
import { ModalCadastro } from "@/components/ModalCadastro";
import { UploadCertificado } from "@/components/UploadCertificado";
import type { Loja } from "@/lib/types";

function faltandoNfce(loja: Loja): string[] {
  const faltando: string[] = [];
  if (!loja.possui_certificado) faltando.push("certificado");
  if (!loja.possui_nfce_csc) faltando.push("CSC");
  return faltando;
}

function faltandoNfe(loja: Loja): string[] {
  return loja.possui_certificado ? [] : ["certificado"];
}

function faltandoMdfe(loja: Loja): string[] {
  return loja.possui_certificado ? [] : ["certificado"];
}

function BadgeFiscal({ rotulo, faltando }: { rotulo: string; faltando: string[] }) {
  const ok = faltando.length === 0;
  return (
    <span
      className={`ml-2 rounded px-1.5 py-0.5 text-xs font-medium ${
        ok ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
      }`}
    >
      {rotulo}
      {!ok && ` (falta ${faltando.join(" e ")})`}
    </span>
  );
}

const FORM_VAZIO = {
  nome: "",
  cnpj: "",
  inscricao_estadual: "",
  razao_social: "",
  endereco: "",
  uf: "",
  ativo: true,
  spedy_ambiente: "sandbox",
  spedy_company_id: "",
  spedy_api_key: "",
  spedy_token_id: "",
  spedy_csc: "",
  spedy_serie_nfce: "",
  mdfe_ambiente: "simulado",
  mdfe_rntrc: "",
  emissao_fiscal_modo: "spedy" as "spedy" | "direta",
  nfce_ambiente: "sandbox",
  nfce_csc: "",
  nfce_csc_id: "",
  nfce_serie: "",
  nfe_ambiente: "sandbox",
  nfe_serie: "",
  cep: "",
  logradouro: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  codigo_municipio: "",
};

export default function LojasPage() {
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<Loja | null>(null);
  const [form, setForm] = useState(FORM_VAZIO);
  const [erro, setErro] = useState<string | null>(null);

  async function carregar() {
    setLojas(await apiFetch<Loja[]>("lojas"));
  }

  useEffect(() => {
    carregar();
  }, []);

  function campo(chave: keyof typeof form, valor: string | boolean) {
    setForm((atual) => ({ ...atual, [chave]: valor }));
  }

  function abrirCriacao() {
    setEditando(null);
    setForm(FORM_VAZIO);
    setErro(null);
    setModalAberto(true);
  }

  function abrirEdicao(loja: Loja) {
    setEditando(loja);
    setForm({
      nome: loja.nome,
      cnpj: loja.cnpj ?? "",
      inscricao_estadual: loja.inscricao_estadual ?? "",
      razao_social: loja.razao_social ?? "",
      endereco: loja.endereco ?? "",
      uf: loja.uf ?? "",
      ativo: loja.ativo,
      spedy_ambiente: loja.spedy_ambiente ?? "sandbox",
      spedy_company_id: loja.spedy_company_id ?? "",
      spedy_api_key: "",
      spedy_token_id: "",
      spedy_csc: "",
      spedy_serie_nfce: loja.spedy_serie_nfce ?? "",
      mdfe_ambiente: loja.mdfe_ambiente ?? "simulado",
      mdfe_rntrc: loja.mdfe_rntrc ?? "",
      emissao_fiscal_modo: loja.emissao_fiscal_modo ?? "spedy",
      nfce_ambiente: loja.nfce_ambiente ?? "sandbox",
      nfce_csc: "",
      nfce_csc_id: loja.nfce_csc_id ?? "",
      nfce_serie: loja.nfce_serie ?? "",
      nfe_ambiente: loja.nfe_ambiente ?? "sandbox",
      nfe_serie: loja.nfe_serie ?? "",
      cep: loja.cep ?? "",
      logradouro: loja.logradouro ?? "",
      numero: loja.numero ?? "",
      complemento: loja.complemento ?? "",
      bairro: loja.bairro ?? "",
      cidade: loja.cidade ?? "",
      codigo_municipio: loja.codigo_municipio ?? "",
    });
    setErro(null);
    setModalAberto(true);
  }

  async function salvar(event: React.FormEvent) {
    event.preventDefault();
    setErro(null);

    const payload = {
      nome: form.nome,
      cnpj: form.cnpj || null,
      inscricao_estadual: form.inscricao_estadual || null,
      razao_social: form.razao_social || null,
      endereco: form.endereco || null,
      uf: form.uf || null,
      ativo: form.ativo,
      spedy_ambiente: form.spedy_ambiente || null,
      spedy_company_id: form.spedy_company_id || null,
      spedy_api_key: form.spedy_api_key || null,
      spedy_token_id: form.spedy_token_id || null,
      spedy_csc: form.spedy_csc || null,
      spedy_serie_nfce: form.spedy_serie_nfce || null,
      mdfe_ambiente: form.mdfe_ambiente || null,
      mdfe_rntrc: form.mdfe_rntrc || null,
      emissao_fiscal_modo: form.emissao_fiscal_modo,
      nfce_ambiente: form.nfce_ambiente || null,
      nfce_csc: form.nfce_csc || null,
      nfce_csc_id: form.nfce_csc_id || null,
      nfce_serie: form.nfce_serie || null,
      nfe_ambiente: form.nfe_ambiente || null,
      nfe_serie: form.nfe_serie || null,
      cep: form.cep || null,
      logradouro: form.logradouro || null,
      numero: form.numero || null,
      complemento: form.complemento || null,
      bairro: form.bairro || null,
      cidade: form.cidade || null,
      codigo_municipio: form.codigo_municipio || null,
    };

    try {
      if (editando) {
        await apiFetch(`lojas/${editando.id}`, { method: "PUT", body: JSON.stringify(payload) });
      } else {
        await apiFetch("lojas", { method: "POST", body: JSON.stringify(payload) });
      }
      setModalAberto(false);
      await carregar();
    } catch {
      setErro("Não foi possível salvar a loja.");
    }
  }

  return (
    <div className="max-w-2xl text-slate-900">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Store className="h-5 w-5 text-blue-600" />
          Lojas
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
        {lojas.map((loja) => (
          <li key={loja.id} className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <Store className="h-5 w-5 text-slate-400" />
              <div>
                <p className="font-medium">
                  {loja.nome}
                  {loja.possui_spedy_proprio && (
                    <span className="ml-2 rounded bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-700">
                      CNPJ próprio
                    </span>
                  )}
                  {loja.emissao_fiscal_modo === "direta" && (
                    <BadgeFiscal rotulo="NFC-e direta" faltando={faltandoNfce(loja)} />
                  )}
                  {loja.emissao_fiscal_modo === "direta" && (
                    <BadgeFiscal rotulo="NF-e direta" faltando={faltandoNfe(loja)} />
                  )}
                  {loja.mdfe_ambiente && loja.mdfe_ambiente !== "simulado" && (
                    <BadgeFiscal rotulo="MDF-e" faltando={faltandoMdfe(loja)} />
                  )}
                </p>
                <p className="flex items-center gap-1 text-sm text-slate-500">
                  <MapPin className="h-3.5 w-3.5" />
                  {loja.endereco ?? "Sem endereço cadastrado"}
                  {loja.cnpj ? ` — ${loja.cnpj}` : ""}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-sm ${loja.ativo ? "text-emerald-600" : "text-slate-500"}`}>
                {loja.ativo ? "Ativa" : "Inativa"}
              </span>
              <button
                onClick={() => abrirEdicao(loja)}
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
          titulo={editando ? "Editar Loja" : "Nova Loja"}
          icone={Store}
          onFechar={() => setModalAberto(false)}
          largura="xl"
        >
          <form onSubmit={salvar}>
            <div className="mb-3 grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="mb-1 block text-sm text-slate-500">Nome da loja</label>
                <input
                  autoFocus
                  value={form.nome}
                  onChange={(e) => campo("nome", e.target.value)}
                  required
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

            <div className="mb-3 grid grid-cols-4 gap-3">
              <div>
                <label className="mb-1 block text-sm text-slate-500">CNPJ</label>
                <input
                  value={form.cnpj}
                  onChange={(e) => campo("cnpj", e.target.value)}
                  placeholder="pode ser diferente da matriz"
                  className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-500">Inscrição Estadual</label>
                <input
                  value={form.inscricao_estadual}
                  onChange={(e) => campo("inscricao_estadual", e.target.value)}
                  placeholder="obrigatória pra NFC-e/NF-e"
                  className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                />
              </div>
              <div className="col-span-2">
                <label className="mb-1 block text-sm text-slate-500">Razão social</label>
                <input
                  value={form.razao_social}
                  onChange={(e) => campo("razao_social", e.target.value)}
                  className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="mb-3">
              <label className="mb-1 block text-sm text-slate-500">Endereço (texto livre)</label>
              <input
                value={form.endereco}
                onChange={(e) => campo("endereco", e.target.value)}
                className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
              />
            </div>

            {editando && (
              <>
                <p className="mb-2 text-sm font-medium text-slate-700">
                  Endereço estruturado (necessário pra emitir MDF-e)
                </p>
                <div className="mb-3 grid grid-cols-3 gap-3">
                  <div>
                    <label className="mb-1 block text-sm text-slate-500">CEP</label>
                    <input
                      value={form.cep}
                      onChange={(e) => campo("cep", e.target.value)}
                      className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="mb-1 block text-sm text-slate-500">
                      Buscar cidade {form.cidade && `— selecionada: ${form.cidade}/${form.uf}`}
                    </label>
                    <BuscaMunicipio
                      onSelecionar={(municipio) => {
                        campo("cidade", municipio.nome);
                        campo("codigo_municipio", municipio.codigo_ibge);
                        campo("uf", municipio.uf);
                      }}
                    />
                  </div>
                </div>
                <div className="mb-4 grid grid-cols-4 gap-3">
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
                  <div>
                    <label className="mb-1 block text-sm text-slate-500">Bairro</label>
                    <input
                      value={form.bairro}
                      onChange={(e) => campo("bairro", e.target.value)}
                      className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </>
            )}

            {editando && (
              <div className="mb-4 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="ativo"
                  checked={form.ativo}
                  onChange={(e) => campo("ativo", e.target.checked)}
                  className="h-4 w-4"
                />
                <label htmlFor="ativo" className="text-sm text-slate-700">
                  Loja ativa
                </label>
              </div>
            )}

            {editando && (
              <>
                <p className="mb-2 text-sm font-medium text-slate-700">Como essa loja emite NFC-e?</p>
                <div className="mb-4 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => campo("emissao_fiscal_modo", "spedy")}
                    className={`rounded border px-3 py-2 text-left text-sm ${
                      form.emissao_fiscal_modo === "spedy"
                        ? "border-blue-500 bg-blue-600 text-white"
                        : "border-slate-300 bg-white text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <span className="block font-medium">Via Spedy (gateway)</span>
                    <span className={form.emissao_fiscal_modo === "spedy" ? "text-blue-100" : "text-slate-400"}>
                      Cobra por documento, mais simples de configurar
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => campo("emissao_fiscal_modo", "direta")}
                    className={`rounded border px-3 py-2 text-left text-sm ${
                      form.emissao_fiscal_modo === "direta"
                        ? "border-blue-500 bg-blue-600 text-white"
                        : "border-slate-300 bg-white text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <span className="block font-medium">Direta na SEFAZ</span>
                    <span className={form.emissao_fiscal_modo === "direta" ? "text-blue-100" : "text-slate-400"}>
                      Sem taxa por documento, exige certificado + CSC próprios
                    </span>
                  </button>
                </div>

                <div className="mb-4 rounded border border-slate-200 bg-slate-50 p-3">
                  <p className="mb-2 text-sm font-medium text-slate-700">Certificado digital (A1)</p>
                  <p className="mb-3 text-xs text-slate-500">
                    Fica guardado aqui, criptografado — é o mesmo arquivo usado pra assinar MDF-e, NFC-e e NF-e
                    emitidos direto na SEFAZ (é sempre o mesmo CNPJ assinando), não precisa subir de novo pra cada
                    tipo de nota.
                  </p>
                  <UploadCertificado endpoint={`lojas/${editando.id}/certificado-fiscal`} aposEnviar={carregar} />
                </div>

                {form.emissao_fiscal_modo === "direta" && (
                  <div className="mb-4">
                    <p className="mb-3 text-xs text-slate-500">
                      CSC e CSC ID vêm do credenciamento da loja na SEFAZ do estado — não são gerados por nós.
                    </p>
                    <div className="mb-3 grid grid-cols-3 gap-3">
                      <div>
                        <label className="mb-1 block text-sm text-slate-500">Ambiente</label>
                        <select
                          value={form.nfce_ambiente}
                          onChange={(e) => campo("nfce_ambiente", e.target.value)}
                          className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                        >
                          <option value="sandbox">Homologação (SEFAZ real)</option>
                          <option value="producao">Produção</option>
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-sm text-slate-500">Série NFC-e</label>
                        <input
                          value={form.nfce_serie}
                          onChange={(e) => campo("nfce_serie", e.target.value)}
                          className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm text-slate-500">CSC ID</label>
                        <input
                          value={form.nfce_csc_id}
                          onChange={(e) => campo("nfce_csc_id", e.target.value)}
                          className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>
                    <div className="mb-3">
                      <label className="mb-1 block text-sm text-slate-500">CSC</label>
                      <input
                        type="password"
                        autoComplete="off"
                        value={form.nfce_csc}
                        onChange={(e) => campo("nfce_csc", e.target.value)}
                        placeholder={editando.possui_nfce_configurado ? "••••••••• (já configurado)" : "não configurado"}
                        className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                      />
                    </div>

                    <p className="mb-2 text-sm font-medium text-slate-700">NF-e (venda de atacado/revenda)</p>
                    <div className="mb-3 grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-sm text-slate-500">Ambiente</label>
                        <select
                          value={form.nfe_ambiente}
                          onChange={(e) => campo("nfe_ambiente", e.target.value)}
                          className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                        >
                          <option value="sandbox">Homologação (SEFAZ real)</option>
                          <option value="producao">Produção</option>
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-sm text-slate-500">Série NF-e</label>
                        <input
                          value={form.nfe_serie}
                          onChange={(e) => campo("nfe_serie", e.target.value)}
                          className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {form.emissao_fiscal_modo === "spedy" && (
                  <>
                    <p className="mb-2 text-sm font-medium text-slate-700">Fiscal próprio da loja (opcional)</p>
                    <p className="mb-3 text-xs text-slate-500">
                      Só preencha se essa loja emitir nota com CNPJ e credenciamento diferentes da empresa. Deixe em
                      branco pra usar a config da empresa. Campos sensíveis em branco mantêm o valor já salvo.
                    </p>

                    <div className="mb-3 grid grid-cols-3 gap-3">
                  <div>
                    <label className="mb-1 block text-sm text-slate-500">Ambiente</label>
                    <select
                      value={form.spedy_ambiente}
                      onChange={(e) => campo("spedy_ambiente", e.target.value)}
                      className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                    >
                      <option value="sandbox">Sandbox (testes)</option>
                      <option value="producao">Produção</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-slate-500">Série NFC-e</label>
                    <input
                      value={form.spedy_serie_nfce}
                      onChange={(e) => campo("spedy_serie_nfce", e.target.value)}
                      className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-slate-500">Company ID</label>
                    <input
                      value={form.spedy_company_id}
                      onChange={(e) => campo("spedy_company_id", e.target.value)}
                      className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="mb-4 grid grid-cols-3 gap-3">
                  <div>
                    <label className="mb-1 block text-sm text-slate-500">API Key</label>
                    <input
                      type="password"
                      autoComplete="off"
                      value={form.spedy_api_key}
                      onChange={(e) => campo("spedy_api_key", e.target.value)}
                      placeholder={editando.possui_spedy_proprio ? "••••••••• (já configurada)" : "não configurada"}
                      className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-slate-500">CSC</label>
                    <input
                      type="password"
                      autoComplete="off"
                      value={form.spedy_csc}
                      onChange={(e) => campo("spedy_csc", e.target.value)}
                      placeholder={editando.possui_spedy_proprio ? "••••••••• (já configurado)" : "não configurado"}
                      className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-slate-500">Token ID</label>
                    <input
                      value={form.spedy_token_id}
                      onChange={(e) => campo("spedy_token_id", e.target.value)}
                      placeholder={editando.possui_spedy_proprio ? "já configurado" : "não configurado"}
                      className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="mb-4 rounded border border-slate-200 bg-slate-50 p-3">
                  <p className="mb-2 text-sm font-medium text-slate-700">Certificado digital (A1) — Spedy</p>
                  <p className="mb-3 text-xs text-slate-500">
                    Sobe o arquivo .pfx direto pra Spedy (não fica salvo aqui) — salve o Company ID e a API Key acima
                    antes de enviar.
                  </p>
                  <UploadCertificado endpoint={`lojas/${editando.id}/spedy-certificado`} />
                </div>
                  </>
                )}

                <p className="mb-2 text-sm font-medium text-slate-700">MDF-e (manifesto de transporte)</p>
                <p className="mb-3 text-xs text-slate-500">
                  Diferente da NFC-e/NF-e, o MDF-e é emitido direto na SEFAZ — não tem gateway. Use{" "}
                  <strong>Simulado</strong> pra testar o fluxo inteiro (cadastro, manifesto, emissão) sem precisar de
                  certificado nem conta na SEFAZ ainda.
                </p>

                <div className="mb-3 grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-sm text-slate-500">Ambiente</label>
                    <select
                      value={form.mdfe_ambiente}
                      onChange={(e) => campo("mdfe_ambiente", e.target.value)}
                      className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                    >
                      <option value="simulado">Simulado (teste sem SEFAZ)</option>
                      <option value="sandbox">Homologação (SEFAZ real)</option>
                      <option value="producao">Produção</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-slate-500">RNTRC</label>
                    <input
                      value={form.mdfe_rntrc}
                      onChange={(e) => campo("mdfe_rntrc", e.target.value)}
                      className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
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
