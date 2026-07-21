"use client";

import { AlertCircle, CheckCircle2, FileText, Plus, Send, Trash2, Truck } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "@/lib/apiClient";
import { BuscaMunicipio } from "@/components/BuscaMunicipio";
import { ModalCadastro } from "@/components/ModalCadastro";
import type { Condutor, Loja, ManifestoTransporte, StatusManifesto, TransferenciaEstoque, Veiculo } from "@/lib/types";

type PaginaManifestos = { data: ManifestoTransporte[]; current_page: number; last_page: number; total: number };

const TIPOS_CARGA: Record<string, string> = {
  "01": "Granel sólido",
  "02": "Granel líquido",
  "03": "Frigorificada",
  "04": "Conteinerizada",
  "05": "Carga Geral",
  "06": "Neogranel",
};

const STATUS_ESTILO: Record<StatusManifesto, string> = {
  rascunho: "bg-slate-100 text-slate-600",
  enviado: "bg-amber-100 text-amber-700",
  autorizado: "bg-emerald-100 text-emerald-700",
  rejeitado: "bg-red-100 text-red-700",
  encerrado: "bg-blue-100 text-blue-700",
  cancelado: "bg-slate-200 text-slate-500",
};

const STATUS_ROTULO: Record<StatusManifesto, string> = {
  rascunho: "Rascunho",
  enviado: "Enviado",
  autorizado: "Autorizado",
  rejeitado: "Rejeitado",
  encerrado: "Encerrado",
  cancelado: "Cancelado",
};

type DocumentoForm = { tipo: "nfe" | "cte"; chave: string };

const FORM_VAZIO = {
  loja_id: "",
  transferencia_estoque_id: "" as string | number,
  veiculo_tracao_id: "",
  tp_emitente: "1" as "1" | "2" | "3",
  serie: "1",
  uf_ini: "",
  uf_fim: "",
  municipio_carregamento_codigo: "",
  municipio_carregamento_nome: "",
  municipio_descarga_codigo: "",
  municipio_descarga_nome: "",
  tipo_carga: "05",
  descricao_produto: "",
  ncm: "",
  valor_carga: "",
  peso_carga_kg: "",
  dh_inicio_viagem: "",
};

export default function ManifestosTransportePage() {
  const searchParams = useSearchParams();
  const transferenciaIdParam = searchParams.get("transferencia_id");

  const [manifestos, setManifestos] = useState<ManifestoTransporte[]>([]);
  const [pagina, setPagina] = useState(1);
  const [ultimaPagina, setUltimaPagina] = useState(1);

  const [lojas, setLojas] = useState<Loja[]>([]);
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [condutores, setCondutores] = useState<Condutor[]>([]);

  const [modalAberto, setModalAberto] = useState(false);
  const [form, setForm] = useState(FORM_VAZIO);
  const [documentos, setDocumentos] = useState<DocumentoForm[]>([{ tipo: "nfe", chave: "" }]);
  const [condutorIds, setCondutorIds] = useState<number[]>([]);
  const [reboqueIds, setReboqueIds] = useState<number[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const [emitindoId, setEmitindoId] = useState<number | null>(null);
  const [detalheAberto, setDetalheAberto] = useState<ManifestoTransporte | null>(null);

  async function carregar(paginaAlvo = pagina) {
    const [manifestosResp, lojasResp, veiculosResp, condutoresResp] = await Promise.all([
      apiFetch<PaginaManifestos>(`manifestos-transporte?page=${paginaAlvo}`),
      apiFetch<Loja[]>("lojas"),
      apiFetch<Veiculo[]>("veiculos"),
      apiFetch<Condutor[]>("condutores"),
    ]);
    setManifestos(manifestosResp.data);
    setPagina(manifestosResp.current_page);
    setUltimaPagina(manifestosResp.last_page);
    setLojas(lojasResp);
    setVeiculos(veiculosResp);
    setCondutores(condutoresResp);
  }

  useEffect(() => {
    carregar(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Veio de "Gerar MDF-e" numa transferência de estoque (ver
  // /admin/transferencias) — prefila origem/destino/carga/NF-e a partir
  // dela, só falta o operador escolher veículo/condutor e emitir.
  useEffect(() => {
    if (!transferenciaIdParam || lojas.length === 0) return;

    apiFetch<TransferenciaEstoque>(`transferencias-estoque/${transferenciaIdParam}`).then((transferencia) => {
      const origem = transferencia.loja_origem;
      const destino = transferencia.loja_destino;
      if (!origem || !destino) return;

      const lojaOrigemCompleta = lojas.find((l) => l.id === origem.id);
      const lojaDestinoCompleta = lojas.find((l) => l.id === destino.id);
      const valorCarga = (transferencia.itens ?? []).reduce(
        (soma, item) => soma + Number(item.quantidade) * Number(item.preco_unitario),
        0,
      );

      setForm((atual) => ({
        ...atual,
        loja_id: String(origem.id),
        transferencia_estoque_id: transferencia.id,
        uf_ini: lojaOrigemCompleta?.uf ?? "",
        uf_fim: lojaDestinoCompleta?.uf ?? lojaOrigemCompleta?.uf ?? "",
        municipio_carregamento_codigo: lojaOrigemCompleta?.codigo_municipio ?? "",
        municipio_carregamento_nome: lojaOrigemCompleta?.cidade ?? "",
        municipio_descarga_codigo: lojaDestinoCompleta?.codigo_municipio ?? "",
        municipio_descarga_nome: lojaDestinoCompleta?.cidade ?? "",
        descricao_produto: `Transferência de estoque #${transferencia.id} — ${origem.nome} para ${destino.nome}`,
        valor_carga: valorCarga ? String(valorCarga.toFixed(2)) : atual.valor_carga,
      }));

      if (transferencia.nota_fiscal?.chave_acesso) {
        setDocumentos([{ tipo: "nfe", chave: transferencia.nota_fiscal.chave_acesso }]);
      }

      setModalAberto(true);
    });
  }, [transferenciaIdParam, lojas]);

  const veiculosTracao = veiculos.filter((v) => v.tipo === "tracao");
  const veiculosReboque = veiculos.filter((v) => v.tipo === "reboque");

  function campo<K extends keyof typeof form>(chave: K, valor: (typeof form)[K]) {
    setForm((atual) => ({ ...atual, [chave]: valor }));
  }

  function abrirCriacao() {
    setForm(FORM_VAZIO);
    setDocumentos([{ tipo: "nfe", chave: "" }]);
    setCondutorIds([]);
    setReboqueIds([]);
    setErro(null);
    setModalAberto(true);
  }

  function atualizarDocumento(indice: number, campoDoc: keyof DocumentoForm, valor: string) {
    setDocumentos((atual) =>
      atual.map((doc, i) => (i === indice ? { ...doc, [campoDoc]: valor } : doc)),
    );
  }

  function alternarCondutor(id: number) {
    setCondutorIds((atual) => (atual.includes(id) ? atual.filter((c) => c !== id) : [...atual, id]));
  }

  function alternarReboque(id: number) {
    setReboqueIds((atual) => (atual.includes(id) ? atual.filter((c) => c !== id) : [...atual, id]));
  }

  async function salvar(event: React.FormEvent) {
    event.preventDefault();
    setErro(null);

    if (!form.municipio_carregamento_codigo || !form.municipio_descarga_codigo) {
      setErro("Busque e selecione o município de carregamento e o de descarga.");
      return;
    }

    setSalvando(true);

    try {
      await apiFetch("manifestos-transporte", {
        method: "POST",
        body: JSON.stringify({
          loja_id: Number(form.loja_id),
          transferencia_estoque_id: form.transferencia_estoque_id || null,
          veiculo_tracao_id: Number(form.veiculo_tracao_id),
          tp_emitente: form.tp_emitente,
          serie: form.serie,
          uf_ini: form.uf_ini,
          uf_fim: form.uf_fim,
          municipio_carregamento_codigo: form.municipio_carregamento_codigo,
          municipio_carregamento_nome: form.municipio_carregamento_nome,
          municipio_descarga_codigo: form.municipio_descarga_codigo,
          municipio_descarga_nome: form.municipio_descarga_nome,
          tipo_carga: form.tipo_carga,
          descricao_produto: form.descricao_produto,
          ncm: form.ncm || null,
          valor_carga: Number(form.valor_carga) || 0,
          peso_carga_kg: Number(form.peso_carga_kg) || 0,
          dh_inicio_viagem: form.dh_inicio_viagem || null,
          documentos: documentos.filter((d) => d.chave.trim().length === 44),
          condutor_ids: condutorIds,
          reboque_ids: reboqueIds,
        }),
      });
      setModalAberto(false);
      await carregar(1);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível criar o manifesto.");
    } finally {
      setSalvando(false);
    }
  }

  async function emitir(manifesto: ManifestoTransporte) {
    setEmitindoId(manifesto.id);
    try {
      await apiFetch(`manifestos-transporte/${manifesto.id}/emitir`, { method: "POST" });
      await carregar(pagina);
    } catch (e) {
      window.alert(e instanceof ApiError ? e.message : "Não foi possível emitir o MDF-e.");
    } finally {
      setEmitindoId(null);
    }
  }

  async function excluir(manifesto: ManifestoTransporte) {
    if (!window.confirm(`Excluir o manifesto #${manifesto.numero} (rascunho)?`)) return;
    try {
      await apiFetch(`manifestos-transporte/${manifesto.id}`, { method: "DELETE" });
      await carregar(pagina);
    } catch {
      window.alert("Não foi possível excluir.");
    }
  }

  async function verDetalhe(manifesto: ManifestoTransporte) {
    const completo = await apiFetch<ManifestoTransporte>(`manifestos-transporte/${manifesto.id}`);
    setDetalheAberto(completo);
  }

  return (
    <div className="text-slate-900">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Truck className="h-5 w-5 text-blue-600" />
          Manifestos de Transporte (MDF-e)
        </h2>
        <button
          onClick={abrirCriacao}
          disabled={veiculosTracao.length === 0 || condutores.length === 0}
          className="flex items-center gap-1.5 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          Novo Manifesto
        </button>
      </div>

      {(veiculosTracao.length === 0 || condutores.length === 0) && (
        <p className="mb-4 flex items-center gap-1.5 text-sm text-amber-600">
          <AlertCircle className="h-4 w-4" />
          Cadastre pelo menos um veículo de tração e um condutor antes de criar um manifesto.
        </p>
      )}

      <div className="overflow-auto rounded border border-slate-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr className="divide-x divide-slate-200">
              <th className="px-3 py-2">Nº/Série</th>
              <th className="px-3 py-2">Loja</th>
              <th className="px-3 py-2">Destino</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Ações</th>
            </tr>
          </thead>
          <tbody>
            {manifestos.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-slate-500">
                  Nenhum manifesto criado ainda.
                </td>
              </tr>
            )}
            {manifestos.map((manifesto) => (
              <tr key={manifesto.id} className="divide-x divide-slate-200 border-t border-slate-200">
                <td className="px-3 py-2">
                  {manifesto.numero}/{manifesto.serie}
                </td>
                <td className="px-3 py-2">{manifesto.loja?.nome ?? "—"}</td>
                <td className="px-3 py-2 text-slate-500">
                  {manifesto.municipio_descarga_nome}/{manifesto.uf_fim}
                </td>
                <td className="px-3 py-2">
                  <button
                    onClick={() => verDetalhe(manifesto)}
                    className={`rounded px-1.5 py-0.5 text-xs font-medium hover:opacity-80 ${STATUS_ESTILO[manifesto.status]}`}
                  >
                    {STATUS_ROTULO[manifesto.status]}
                  </button>
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    {manifesto.status === "rascunho" && (
                      <>
                        <button
                          onClick={() => emitir(manifesto)}
                          disabled={emitindoId === manifesto.id}
                          className="flex items-center gap-1 rounded border border-emerald-300 px-2 py-1 text-sm text-emerald-600 hover:bg-emerald-50 disabled:opacity-60"
                        >
                          <Send className="h-3.5 w-3.5" />
                          {emitindoId === manifesto.id ? "Emitindo..." : "Emitir"}
                        </button>
                        <button
                          onClick={() => excluir(manifesto)}
                          className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                          title="Excluir"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {ultimaPagina > 1 && (
        <div className="mt-3 flex items-center justify-between text-sm text-slate-600">
          <span>
            Página {pagina} de {ultimaPagina}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => carregar(pagina - 1)}
              disabled={pagina <= 1}
              className="rounded border border-slate-300 px-3 py-1.5 hover:bg-slate-100 disabled:opacity-40"
            >
              Anterior
            </button>
            <button
              onClick={() => carregar(pagina + 1)}
              disabled={pagina >= ultimaPagina}
              className="rounded border border-slate-300 px-3 py-1.5 hover:bg-slate-100 disabled:opacity-40"
            >
              Próxima
            </button>
          </div>
        </div>
      )}

      {detalheAberto && (
        <ModalCadastro titulo={`Manifesto #${detalheAberto.numero}`} icone={FileText} onFechar={() => setDetalheAberto(null)}>
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${STATUS_ESTILO[detalheAberto.status]}`}>
                {STATUS_ROTULO[detalheAberto.status]}
              </span>
              {detalheAberto.protocolo && <span className="text-slate-500">Protocolo: {detalheAberto.protocolo}</span>}
            </div>
            {detalheAberto.chave_acesso && (
              <p>
                <span className="text-slate-500">Chave de acesso: </span>
                <span className="break-all font-mono text-xs">{detalheAberto.chave_acesso}</span>
              </p>
            )}
            {detalheAberto.mensagem_retorno && (
              <p className={detalheAberto.status === "rejeitado" ? "text-red-600" : "text-emerald-600"}>
                {detalheAberto.status === "rejeitado" ? (
                  <AlertCircle className="mr-1 inline h-4 w-4" />
                ) : (
                  <CheckCircle2 className="mr-1 inline h-4 w-4" />
                )}
                {detalheAberto.mensagem_retorno}
              </p>
            )}
            <p>
              <span className="text-slate-500">Rota: </span>
              {detalheAberto.municipio_carregamento_nome}/{detalheAberto.uf_ini} →{" "}
              {detalheAberto.municipio_descarga_nome}/{detalheAberto.uf_fim}
            </p>
            <p>
              <span className="text-slate-500">Carga: </span>
              {detalheAberto.descricao_produto} — R$ {Number(detalheAberto.valor_carga).toFixed(2)} —{" "}
              {Number(detalheAberto.peso_carga_kg).toFixed(0)} kg
            </p>
            <p>
              <span className="text-slate-500">Veículo: </span>
              {detalheAberto.veiculo_tracao?.placa ?? "—"}
            </p>
            <p>
              <span className="text-slate-500">Condutor(es): </span>
              {detalheAberto.condutores?.map((c) => c.nome).join(", ") ?? "—"}
            </p>
            <div>
              <span className="text-slate-500">Documentos: </span>
              <ul className="mt-1 space-y-1">
                {detalheAberto.documentos?.map((doc) => (
                  <li key={doc.id} className="break-all font-mono text-xs text-slate-600">
                    {doc.tipo.toUpperCase()} — {doc.chave}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              onClick={() => setDetalheAberto(null)}
              className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
            >
              Fechar
            </button>
          </div>
        </ModalCadastro>
      )}

      {modalAberto && (
        <ModalCadastro titulo="Novo Manifesto de Transporte" icone={Truck} onFechar={() => setModalAberto(false)} largura="xl">
          <form onSubmit={salvar}>
            <div className="mb-3 grid grid-cols-3 gap-3">
              <div>
                <label className="mb-1 block text-sm text-slate-500">Loja emissora</label>
                <select
                  value={form.loja_id}
                  onChange={(e) => campo("loja_id", e.target.value)}
                  required
                  className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                >
                  <option value="">Selecione...</option>
                  {lojas.map((loja) => (
                    <option key={loja.id} value={loja.id}>
                      {loja.nome} {loja.mdfe_ambiente === "simulado" ? "(simulado)" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-500">Veículo de tração</label>
                <select
                  value={form.veiculo_tracao_id}
                  onChange={(e) => campo("veiculo_tracao_id", e.target.value)}
                  required
                  className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                >
                  <option value="">Selecione...</option>
                  {veiculosTracao.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.placa}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-500">Tipo de emitente</label>
                <select
                  value={form.tp_emitente}
                  onChange={(e) => campo("tp_emitente", e.target.value as "1" | "2" | "3")}
                  className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                >
                  <option value="1">Prestador de serviço de transporte</option>
                  <option value="2">Transportador de carga própria</option>
                  <option value="3">Contratante do serviço</option>
                </select>
              </div>
            </div>

            {veiculosReboque.length > 0 && (
              <div className="mb-3">
                <label className="mb-1 block text-sm text-slate-500">Reboques (opcional)</label>
                <div className="flex flex-wrap gap-2">
                  {veiculosReboque.map((v) => (
                    <button
                      type="button"
                      key={v.id}
                      onClick={() => alternarReboque(v.id)}
                      className={`rounded border px-2 py-1 text-sm ${
                        reboqueIds.includes(v.id)
                          ? "border-blue-500 bg-blue-600 text-white"
                          : "border-slate-300 bg-white text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      {v.placa}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-3">
              <label className="mb-1 block text-sm text-slate-500">Condutor(es)</label>
              <div className="flex flex-wrap gap-2">
                {condutores.map((c) => (
                  <button
                    type="button"
                    key={c.id}
                    onClick={() => alternarCondutor(c.id)}
                    className={`rounded border px-2 py-1 text-sm ${
                      condutorIds.includes(c.id)
                        ? "border-blue-500 bg-blue-600 text-white"
                        : "border-slate-300 bg-white text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {c.nome}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-3 grid grid-cols-4 gap-3">
              <div>
                <label className="mb-1 block text-sm text-slate-500">UF Origem</label>
                <input
                  maxLength={2}
                  value={form.uf_ini}
                  onChange={(e) => campo("uf_ini", e.target.value.toUpperCase())}
                  required
                  className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-500">UF Destino</label>
                <input
                  maxLength={2}
                  value={form.uf_fim}
                  onChange={(e) => campo("uf_fim", e.target.value.toUpperCase())}
                  required
                  className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                />
              </div>
              <div className="col-span-2">
                <label className="mb-1 block text-sm text-slate-500">Início da viagem</label>
                <input
                  type="datetime-local"
                  value={form.dh_inicio_viagem}
                  onChange={(e) => campo("dh_inicio_viagem", e.target.value)}
                  className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="mb-3 grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm text-slate-500">
                  Município de carregamento
                  {form.municipio_carregamento_nome && ` — ${form.municipio_carregamento_nome}`}
                </label>
                <BuscaMunicipio
                  ufFiltro={form.uf_ini || undefined}
                  onSelecionar={(m) => {
                    campo("municipio_carregamento_codigo", m.codigo_ibge);
                    campo("municipio_carregamento_nome", m.nome);
                  }}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-500">
                  Município de descarga
                  {form.municipio_descarga_nome && ` — ${form.municipio_descarga_nome}`}
                </label>
                <BuscaMunicipio
                  ufFiltro={form.uf_fim || undefined}
                  onSelecionar={(m) => {
                    campo("municipio_descarga_codigo", m.codigo_ibge);
                    campo("municipio_descarga_nome", m.nome);
                  }}
                />
              </div>
            </div>

            <div className="mb-4 grid grid-cols-4 gap-3">
              <div>
                <label className="mb-1 block text-sm text-slate-500">Tipo de carga</label>
                <select
                  value={form.tipo_carga}
                  onChange={(e) => campo("tipo_carga", e.target.value)}
                  className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                >
                  {Object.entries(TIPOS_CARGA).map(([valor, rotulo]) => (
                    <option key={valor} value={valor}>
                      {rotulo}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className="mb-1 block text-sm text-slate-500">Descrição do produto</label>
                <input
                  value={form.descricao_produto}
                  onChange={(e) => campo("descricao_produto", e.target.value)}
                  required
                  className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-500">NCM (opcional)</label>
                <input
                  value={form.ncm}
                  onChange={(e) => campo("ncm", e.target.value)}
                  className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm text-slate-500">Valor da carga (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.valor_carga}
                  onChange={(e) => campo("valor_carga", e.target.value)}
                  required
                  className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-500">Peso da carga (kg)</label>
                <input
                  type="number"
                  step="0.001"
                  value={form.peso_carga_kg}
                  onChange={(e) => campo("peso_carga_kg", e.target.value)}
                  required
                  className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="mb-4">
              <div className="mb-1 flex items-center justify-between">
                <label className="block text-sm text-slate-500">Documentos (NF-e/CT-e) — chave com 44 dígitos</label>
                <button
                  type="button"
                  onClick={() => setDocumentos((atual) => [...atual, { tipo: "nfe", chave: "" }])}
                  className="text-sm text-blue-600 hover:underline"
                >
                  + adicionar
                </button>
              </div>
              {documentos.map((doc, indice) => (
                <div key={indice} className="mb-2 flex gap-2">
                  <select
                    value={doc.tipo}
                    onChange={(e) => atualizarDocumento(indice, "tipo", e.target.value)}
                    className="rounded border border-slate-300 bg-white px-2 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
                  >
                    <option value="nfe">NF-e</option>
                    <option value="cte">CT-e</option>
                  </select>
                  <input
                    value={doc.chave}
                    onChange={(e) => atualizarDocumento(indice, "chave", e.target.value.replace(/\D/g, ""))}
                    maxLength={44}
                    placeholder="44 dígitos"
                    className="flex-1 rounded border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 outline-none focus:border-blue-500"
                  />
                  {documentos.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setDocumentos((atual) => atual.filter((_, i) => i !== indice))}
                      className="rounded p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
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
                disabled={salvando}
                className="flex items-center gap-2 rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-500 disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                {salvando ? "Salvando..." : "Salvar rascunho"}
              </button>
            </div>
          </form>
        </ModalCadastro>
      )}
    </div>
  );
}
