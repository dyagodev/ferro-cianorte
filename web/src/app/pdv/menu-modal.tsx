"use client";

import {
  AlertCircle,
  Banknote,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  DownloadCloud,
  LayoutDashboard,
  ListChecks,
  Lock,
  Menu as MenuIcon,
  Printer,
  ReceiptText,
  RefreshCw,
  Unlock,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { apiFetch, ApiError } from "@/lib/apiClient";
import { imprimir } from "@/lib/imprimir";
import type { StatusAtualizacao } from "@/components/ElectronTitlebar";
import type { FormaPagamento, Venda } from "@/lib/types";
import Cupom, { type VendaConcluida } from "./cupom";

type Fechamento = {
  abertura: { valor: string; created_at: string } | null;
  fundo_troco: number;
  por_forma_pagamento: { forma_pagamento: FormaPagamento; total: string }[];
  total_geral: number;
  sangrias: { id: number; valor: string; observacao: string | null; created_at: string }[];
  total_sangrias: number;
  dinheiro_esperado_em_caixa: number;
};

type Situacao = {
  aberto: boolean;
  abertura: { valor: string; created_at: string } | null;
};

const ROTULO_FORMA: Record<FormaPagamento, string> = {
  boleto: "Boleto",
  cartao: "Cartão Crédito",
  cartao_debito: "Cartão Débito",
  dinheiro: "Dinheiro",
  cheque: "Cheque",
  crediario: "Crediário",
  pix: "Pix",
  a_prazo: "A Prazo",
  outros: "Outros",
};

type Aba = "menu" | "abertura" | "sangria" | "fechamento" | "vendas";

const TITULOS: Record<Aba, string> = {
  menu: "Ctrl+M - Menu",
  abertura: "Abrir Caixa",
  sangria: "Sangria",
  fechamento: "Fechamento de Caixa",
  vendas: "Vendas",
};

export default function MenuModal({
  role,
  lojaId,
  onFechar,
}: {
  role: "admin" | "vendedor";
  lojaId: number | null;
  onFechar: () => void;
}) {
  const [aba, setAba] = useState<Aba>("menu");
  const [situacao, setSituacao] = useState<Situacao | null>(null);
  const [vendaSelecionada, setVendaSelecionada] = useState<Venda | null>(null);

  function carregarSituacao() {
    const query = lojaId ? `?loja_id=${lojaId}` : "";
    apiFetch<Situacao>(`caixa/situacao${query}`)
      .then(setSituacao)
      .catch(() => setSituacao(null));
  }

  useEffect(carregarSituacao, [lojaId]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (vendaSelecionada) {
          setVendaSelecionada(null);
        } else if (aba !== "menu") {
          setAba("menu");
        } else {
          onFechar();
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onFechar, aba, vendaSelecionada]);

  function voltar() {
    if (vendaSelecionada) {
      setVendaSelecionada(null);
    } else {
      setAba("menu");
    }
  }

  const larguraMax = aba === "vendas" ? "max-w-2xl" : "max-w-md";

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/60">
      <div className={`w-full ${larguraMax} rounded-lg border border-slate-300 bg-slate-50 p-6 shadow-2xl`}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-xl font-semibold text-slate-900">
            <MenuIcon className="h-5 w-5 text-blue-600" />
            {vendaSelecionada ? `Venda #${vendaSelecionada.id}` : TITULOS[aba]}
          </h2>
          <button
            onClick={aba === "menu" && !vendaSelecionada ? onFechar : voltar}
            className="flex items-center gap-1 text-slate-500 hover:text-slate-900"
          >
            <X className="h-4 w-4" />
            {aba === "menu" && !vendaSelecionada ? "Esc - Fechar" : "Voltar"}
          </button>
        </div>

        {aba === "menu" && (
          <div className="flex flex-col gap-2">
            {situacao && !situacao.aberto && (
              <button
                onClick={() => setAba("abertura")}
                className="flex items-center gap-2 rounded border border-emerald-300 bg-emerald-50 px-4 py-3 text-left text-emerald-700 hover:bg-emerald-100"
              >
                <Unlock className="h-5 w-5" />
                Abrir Caixa
              </button>
            )}
            {situacao?.aberto && (
              <div className="flex items-center gap-2 rounded border border-emerald-300 bg-emerald-50 px-4 py-3 text-emerald-700">
                <CircleDollarSign className="h-5 w-5" />
                Caixa aberto — fundo de troco R$ {Number(situacao.abertura?.valor ?? 0).toFixed(2)}
              </div>
            )}

            <button
              onClick={() => situacao?.aberto && setAba("sangria")}
              disabled={!situacao?.aberto}
              title={!situacao?.aberto ? "Abra o caixa primeiro" : undefined}
              className="flex items-center gap-2 rounded border border-slate-300 bg-white px-4 py-3 text-left text-slate-900 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Banknote className="h-5 w-5 text-amber-600" />
              Sangria
              {!situacao?.aberto && <Lock className="ml-auto h-4 w-4 text-slate-400" />}
            </button>
            <button
              onClick={() => situacao?.aberto && setAba("fechamento")}
              disabled={!situacao?.aberto}
              title={!situacao?.aberto ? "Abra o caixa primeiro" : undefined}
              className="flex items-center gap-2 rounded border border-slate-300 bg-white px-4 py-3 text-left text-slate-900 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ClipboardList className="h-5 w-5 text-emerald-600" />
              Fechamento de Caixa
              {!situacao?.aberto && <Lock className="ml-auto h-4 w-4 text-slate-400" />}
            </button>
            <button
              onClick={() => setAba("vendas")}
              className="flex items-center gap-2 rounded border border-slate-300 bg-white px-4 py-3 text-left text-slate-900 hover:bg-slate-100"
            >
              <ReceiptText className="h-5 w-5 text-blue-600" />
              Vendas
            </button>
            {role === "admin" && (
              <a
                href="/admin"
                className="flex items-center gap-2 rounded border border-slate-300 bg-white px-4 py-3 text-left text-slate-900 hover:bg-slate-100"
              >
                <LayoutDashboard className="h-5 w-5 text-blue-600" />
                Área Administrativa
              </a>
            )}

            <AtualizacaoApp />
          </div>
        )}

        {aba === "abertura" && (
          <FormularioAbertura lojaId={lojaId} onConcluido={() => { carregarSituacao(); setAba("menu"); }} />
        )}
        {aba === "sangria" && <FormularioSangria lojaId={lojaId} onConcluido={() => setAba("menu")} />}
        {aba === "fechamento" && (
          <ResumoFechamento lojaId={lojaId} onFechado={() => { carregarSituacao(); setAba("menu"); }} />
        )}
        {aba === "vendas" && (
          <VendasLista
            lojaId={lojaId}
            role={role}
            vendaSelecionada={vendaSelecionada}
            onSelecionar={setVendaSelecionada}
          />
        )}
      </div>
    </div>
  );
}

function AtualizacaoApp() {
  const [versao, setVersao] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusAtualizacao | null>(null);
  const [disponivel, setDisponivel] = useState(false);

  useEffect(() => {
    if (!window.electronAPI?.isElectron) return;

    setDisponivel(true);
    window.electronAPI.versaoApp().then(setVersao);

    return window.electronAPI.onStatusAtualizacao(setStatus);
  }, []);

  if (!disponivel) return null;

  const verificando = status?.estado === "verificando";

  return (
    <div className="mt-2 rounded border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
      <div className="flex items-center justify-between">
        <span>Versão {versao ?? "..."}</span>
        {status?.estado === "pronto" ? (
          <button
            onClick={() => window.electronAPI?.instalarAtualizacao()}
            className="flex items-center gap-1.5 rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500"
          >
            <DownloadCloud className="h-3.5 w-3.5" />
            Reiniciar e atualizar
          </button>
        ) : (
          <button
            onClick={() => window.electronAPI?.verificarAtualizacao()}
            disabled={verificando}
            className="flex items-center gap-1.5 rounded border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${verificando ? "animate-spin" : ""}`} />
            Verificar atualização
          </button>
        )}
      </div>

      {status && (
        <p className="mt-1.5 text-xs text-slate-500">
          {status.estado === "verificando" && "Verificando atualização..."}
          {status.estado === "disponivel" && `Baixando atualização v${status.versao}...`}
          {status.estado === "baixando" && `Baixando... ${status.percentual}%`}
          {status.estado === "pronto" && `Atualização v${status.versao} pronta para instalar.`}
          {status.estado === "atualizado" && "Você já está na versão mais recente."}
          {status.estado === "erro" && `Não foi possível verificar: ${status.mensagem}`}
        </p>
      )}
    </div>
  );
}

function FormularioAbertura({ lojaId, onConcluido }: { lojaId: number | null; onConcluido: () => void }) {
  const [valor, setValor] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [concluida, setConcluida] = useState(false);

  async function confirmar(event: React.FormEvent) {
    event.preventDefault();
    setEnviando(true);
    setErro(null);

    try {
      await apiFetch("caixa/abertura", {
        method: "POST",
        body: JSON.stringify({ loja_id: lojaId, valor: Number(valor) || 0 }),
      });
      setConcluida(true);
      setTimeout(onConcluido, 1000);
    } catch {
      setErro("Não foi possível abrir o caixa.");
    } finally {
      setEnviando(false);
    }
  }

  if (concluida) {
    return (
      <div className="flex flex-col items-center gap-2 py-6 text-emerald-600">
        <Unlock className="h-8 w-8" />
        <p className="font-medium">Caixa aberto!</p>
      </div>
    );
  }

  return (
    <form onSubmit={confirmar}>
      <label className="mb-1 block text-sm text-slate-500">Fundo de troco inicial R$</label>
      <input
        type="number"
        step="0.01"
        min="0"
        autoFocus
        required
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        className="mb-4 w-full rounded border border-slate-300 bg-white px-3 py-2 text-xl text-slate-900 outline-none focus:border-blue-500"
      />

      {erro && <p className="mb-4 text-sm text-red-600">{erro}</p>}

      <button
        type="submit"
        disabled={enviando}
        className="flex w-full items-center justify-center gap-2 rounded bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
      >
        <Unlock className="h-4 w-4" />
        {enviando ? "Abrindo..." : "Abrir caixa"}
      </button>
    </form>
  );
}

function FormularioSangria({ lojaId, onConcluido }: { lojaId: number | null; onConcluido: () => void }) {
  const [valor, setValor] = useState("");
  const [observacao, setObservacao] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [concluida, setConcluida] = useState(false);

  async function confirmar(event: React.FormEvent) {
    event.preventDefault();
    setEnviando(true);
    setErro(null);

    try {
      await apiFetch("caixa/sangrias", {
        method: "POST",
        body: JSON.stringify({ loja_id: lojaId, valor: Number(valor), observacao: observacao || null }),
      });
      setConcluida(true);
      setTimeout(onConcluido, 1200);
    } catch {
      setErro("Não foi possível registrar a sangria.");
    } finally {
      setEnviando(false);
    }
  }

  if (concluida) {
    return (
      <div className="flex flex-col items-center gap-2 py-6 text-emerald-600">
        <Banknote className="h-8 w-8" />
        <p className="font-medium">Sangria registrada!</p>
      </div>
    );
  }

  return (
    <form onSubmit={confirmar}>
      <label className="mb-1 block text-sm text-slate-500">Valor retirado R$</label>
      <input
        type="number"
        step="0.01"
        min="0.01"
        autoFocus
        required
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        className="mb-3 w-full rounded border border-slate-300 bg-white px-3 py-2 text-xl text-slate-900 outline-none focus:border-blue-500"
      />

      <label className="mb-1 block text-sm text-slate-500">Observação (opcional)</label>
      <input
        value={observacao}
        onChange={(e) => setObservacao(e.target.value)}
        placeholder="Ex.: depósito no banco"
        className="mb-4 w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
      />

      {erro && <p className="mb-4 text-sm text-red-600">{erro}</p>}

      <button
        type="submit"
        disabled={enviando}
        className="flex w-full items-center justify-center gap-2 rounded bg-amber-600 px-4 py-2 font-medium text-white hover:bg-amber-500 disabled:opacity-60"
      >
        <Banknote className="h-4 w-4" />
        {enviando ? "Registrando..." : "Confirmar sangria"}
      </button>
    </form>
  );
}

function ResumoFechamento({ lojaId, onFechado }: { lojaId: number | null; onFechado: () => void }) {
  const [dados, setDados] = useState<Fechamento | null>(null);
  const [erro, setErro] = useState(false);
  const [valorConferido, setValorConferido] = useState("");
  const [confirmando, setConfirmando] = useState(false);
  const [erroFechar, setErroFechar] = useState<string | null>(null);
  const [fechado, setFechado] = useState<{ diferenca: number } | null>(null);

  useEffect(() => {
    const query = lojaId ? `?loja_id=${lojaId}` : "";
    apiFetch<Fechamento>(`caixa/fechamento${query}`)
      .then((d) => {
        setDados(d);
        setValorConferido(d.dinheiro_esperado_em_caixa.toFixed(2));
      })
      .catch(() => setErro(true));
  }, [lojaId]);

  async function confirmarFechamento() {
    setConfirmando(true);
    setErroFechar(null);

    try {
      const resultado = await apiFetch<{ diferenca: number }>("caixa/fechamento", {
        method: "POST",
        body: JSON.stringify({ loja_id: lojaId, valor_conferido: Number(valorConferido) || 0 }),
      });
      setFechado(resultado);
      setTimeout(onFechado, 1800);
    } catch {
      setErroFechar("Não foi possível fechar o caixa.");
    } finally {
      setConfirmando(false);
    }
  }

  if (erro) return <p className="text-red-600">Não foi possível carregar o fechamento de caixa.</p>;
  if (!dados) return <p className="text-slate-500">Carregando...</p>;

  if (fechado) {
    const diferencaOk = Math.abs(fechado.diferenca) < 0.01;
    return (
      <div className="flex flex-col items-center gap-2 py-6 text-center">
        <CheckCircle2 className={`h-8 w-8 ${diferencaOk ? "text-emerald-600" : "text-amber-600"}`} />
        <p className="font-medium text-slate-900">Caixa fechado!</p>
        <p className={diferencaOk ? "text-emerald-600" : "text-amber-600"}>
          {diferencaOk
            ? "Sem diferença — bateu certinho."
            : `Diferença: R$ ${fechado.diferenca.toFixed(2)} ${fechado.diferenca > 0 ? "a mais" : "a menos"}`}
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-slate-600">
        <ListChecks className="h-4 w-4" />
        Recebido hoje por forma de pagamento
      </p>
      <ul className="mb-4 divide-y divide-slate-200 rounded border border-slate-200">
        {dados.por_forma_pagamento.map((item) => (
          <li key={item.forma_pagamento} className="flex justify-between px-3 py-2 text-sm text-slate-900">
            <span>{ROTULO_FORMA[item.forma_pagamento]}</span>
            <span>R$ {Number(item.total).toFixed(2)}</span>
          </li>
        ))}
        {dados.por_forma_pagamento.length === 0 && (
          <li className="px-3 py-4 text-center text-sm text-slate-500">Nenhuma venda hoje ainda.</li>
        )}
      </ul>

      <div className="mb-4 flex justify-between rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900">
        <span>Total recebido hoje</span>
        <span className="font-semibold">R$ {dados.total_geral.toFixed(2)}</span>
      </div>

      {dados.sangrias.length > 0 && (
        <>
          <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-slate-600">
            <Banknote className="h-4 w-4" />
            Sangrias de hoje
          </p>
          <ul className="mb-4 divide-y divide-slate-200 rounded border border-slate-200">
            {dados.sangrias.map((sangria) => (
              <li key={sangria.id} className="flex justify-between px-3 py-2 text-sm text-slate-900">
                <span>{sangria.observacao ?? "Sem observação"}</span>
                <span>R$ {Number(sangria.valor).toFixed(2)}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="mb-4 flex items-center justify-between rounded border border-emerald-300 bg-emerald-50 px-3 py-3 text-emerald-700">
        <span className="flex items-center gap-1.5 font-medium">
          <CircleDollarSign className="h-4 w-4" />
          Dinheiro esperado em caixa
        </span>
        <span className="text-lg font-semibold">R$ {dados.dinheiro_esperado_em_caixa.toFixed(2)}</span>
      </div>

      <label className="mb-1 block text-sm text-slate-500">Valor conferido na gaveta R$</label>
      <input
        type="number"
        step="0.01"
        value={valorConferido}
        onChange={(e) => setValorConferido(e.target.value)}
        className="mb-4 w-full rounded border border-slate-300 bg-white px-3 py-2 text-xl text-slate-900 outline-none focus:border-blue-500"
      />

      {erroFechar && (
        <p className="mb-4 flex items-center gap-1.5 text-sm text-red-600">
          <AlertCircle className="h-4 w-4" />
          {erroFechar}
        </p>
      )}

      <button
        onClick={confirmarFechamento}
        disabled={confirmando}
        className="flex w-full items-center justify-center gap-2 rounded bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
      >
        <Lock className="h-4 w-4" />
        {confirmando ? "Fechando..." : "Fechar caixa"}
      </button>
    </div>
  );
}

type PaginaVendas = {
  data: Venda[];
  current_page: number;
  last_page: number;
};

function VendasLista({
  lojaId,
  role,
  vendaSelecionada,
  onSelecionar,
}: {
  lojaId: number | null;
  role: "admin" | "vendedor";
  vendaSelecionada: Venda | null;
  onSelecionar: (venda: Venda | null) => void;
}) {
  const [dados, setDados] = useState<PaginaVendas | null>(null);
  const [pagina, setPagina] = useState(1);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    if (vendaSelecionada) return;

    const query = new URLSearchParams({ page: String(pagina) });
    if (lojaId) query.set("loja_id", String(lojaId));

    apiFetch<PaginaVendas>(`vendas?${query.toString()}`)
      .then(setDados)
      .catch(() => setErro(true));
  }, [lojaId, pagina, vendaSelecionada]);

  if (vendaSelecionada) {
    return <VendaDetalhe venda={vendaSelecionada} role={role} onAtualizar={onSelecionar} />;
  }

  if (erro) return <p className="text-red-600">Não foi possível carregar as vendas.</p>;
  if (!dados) return <p className="text-slate-500">Carregando...</p>;

  return (
    <div>
      <div className="max-h-96 overflow-auto rounded border border-slate-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr className="divide-x divide-slate-200">
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2">Data</th>
              <th className="px-3 py-2">Origem</th>
              <th className="px-3 py-2">Cliente</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Total</th>
            </tr>
          </thead>
          <tbody>
            {dados.data.map((venda) => {
              const cancelada = venda.status === "cancelada";
              return (
                <tr
                  key={venda.id}
                  onClick={() => onSelecionar(venda)}
                  className={`cursor-pointer divide-x divide-slate-200 border-t border-slate-200 hover:bg-slate-100 ${cancelada ? "text-slate-400" : "text-slate-900"}`}
                >
                  <td className="px-3 py-2">{venda.id}</td>
                  <td className="px-3 py-2">{new Date(venda.created_at).toLocaleString("pt-BR")}</td>
                  <td className="px-3 py-2">
                    <BadgeOrigem venda={venda} />
                  </td>
                  <td className="px-3 py-2">{venda.cliente?.nome ?? "—"}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cancelada ? "bg-slate-200 text-slate-600" : "bg-emerald-100 text-emerald-700"}`}>
                      {cancelada ? "Cancelada" : "Concluída"}
                    </span>
                  </td>
                  <td className={`px-3 py-2 ${cancelada ? "line-through" : ""}`}>R$ {Number(venda.total).toFixed(2)}</td>
                </tr>
              );
            })}
            {dados.data.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-slate-500">
                  Nenhuma venda encontrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-between text-sm text-slate-600">
        <span>
          Página {dados.current_page} de {dados.last_page}
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => setPagina((p) => Math.max(1, p - 1))}
            disabled={dados.current_page <= 1}
            className="rounded border border-slate-300 px-3 py-1 hover:bg-slate-100 disabled:opacity-40"
          >
            Anterior
          </button>
          <button
            onClick={() => setPagina((p) => p + 1)}
            disabled={dados.current_page >= dados.last_page}
            className="rounded border border-slate-300 px-3 py-1 hover:bg-slate-100 disabled:opacity-40"
          >
            Próxima
          </button>
        </div>
      </div>
    </div>
  );
}

function BadgeOrigem({ venda }: { venda: Venda }) {
  if (venda.sync_conexao_id) {
    return (
      <span className="rounded-full border border-indigo-200 bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
        Link Pro
      </span>
    );
  }
  return (
    <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
      PDV
    </span>
  );
}

function vendaParaCupom(venda: Venda): VendaConcluida {
  return {
    id: venda.id,
    dataHora: venda.created_at,
    lojaNome: venda.loja?.nome ?? "—",
    vendedorNome: venda.vendedor_externo_nome ?? venda.vendedor.name,
    clienteNome: venda.cliente?.nome ?? "não informado",
    itens: venda.itens.map((item) => ({
      descricao: item.produto?.descricao ?? item.servico?.descricao ?? `#${item.produto_id ?? item.servico_id}`,
      quantidade: Number(item.quantidade),
      precoOriginal: Number(item.preco_original),
      precoUnitario: Number(item.preco_unitario),
    })),
    pagamentos: venda.pagamentos.map((pagamento) => ({
      forma_pagamento: pagamento.forma_pagamento,
      valor: Number(pagamento.valor),
    })),
    subtotal: Number(venda.subtotal),
    desconto: Number(venda.desconto),
    total: Number(venda.total),
  };
}

function VendaDetalhe({
  venda,
  role,
  onAtualizar,
}: {
  venda: Venda;
  role: "admin" | "vendedor";
  onAtualizar: (venda: Venda) => void;
}) {
  const cancelada = venda.status === "cancelada";
  const nomeVendedor = venda.vendedor_externo_nome ?? venda.vendedor.name;
  const notas = venda.notas_fiscais ?? [];
  const jaAutorizada = notas.some((n) => n.status === "authorized");
  const [emitindo, setEmitindo] = useState(false);
  const [erroEmissao, setErroEmissao] = useState<string | null>(null);
  const [cancelandoId, setCancelandoId] = useState<number | null>(null);
  const [erroCancelamento, setErroCancelamento] = useState<string | null>(null);

  async function cancelarNota(nota: NonNullable<Venda["notas_fiscais"]>[number]) {
    const justificativa = window.prompt(
      "Justificativa do cancelamento (mín. 15 caracteres, exigido pela SEFAZ):",
    );
    if (!justificativa) return;
    if (justificativa.trim().length < 15) {
      window.alert("A justificativa precisa ter pelo menos 15 caracteres.");
      return;
    }
    if (!window.confirm("Confirma o cancelamento dessa NFC-e na SEFAZ? Essa ação não pode ser desfeita.")) {
      return;
    }
    setCancelandoId(nota.id);
    setErroCancelamento(null);
    try {
      const atualizada = await apiFetch<NonNullable<Venda["notas_fiscais"]>[number]>(
        `notas-fiscais/${nota.id}/cancelar`,
        { method: "POST", body: JSON.stringify({ justificativa: justificativa.trim() }) },
      );
      onAtualizar({
        ...venda,
        notas_fiscais: notas.map((n) => (n.id === atualizada.id ? atualizada : n)),
      });
    } catch (e) {
      setErroCancelamento(e instanceof ApiError ? e.message : "Não foi possível cancelar a nota fiscal.");
    } finally {
      setCancelandoId(null);
    }
  }

  async function emitirNota() {
    setEmitindo(true);
    setErroEmissao(null);
    try {
      const resposta = await apiFetch<{ notas_fiscais: NonNullable<Venda["notas_fiscais"]> }>(
        `vendas/${venda.id}/emitir-nota`,
        { method: "POST" },
      );
      onAtualizar({ ...venda, notas_fiscais: resposta.notas_fiscais });
    } catch (e) {
      setErroEmissao(e instanceof ApiError ? e.message : "Não foi possível emitir a nota fiscal.");
    } finally {
      setEmitindo(false);
    }
  }

  return (
    <div>
      <div className="mb-4 flex justify-end gap-2 print:hidden">
        {role === "admin" && !cancelada && !jaAutorizada && (
          <button
            onClick={emitirNota}
            disabled={emitindo}
            className="flex items-center gap-1.5 rounded border border-blue-300 px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 disabled:opacity-50"
          >
            <ReceiptText className="h-4 w-4" />
            {emitindo ? "Emitindo..." : "Emitir nota fiscal"}
          </button>
        )}
        <button
          onClick={() => imprimir()}
          className="flex items-center gap-1.5 rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500"
        >
          <Printer className="h-4 w-4" />
          Imprimir
        </button>
      </div>

      {role === "admin" && (notas.length > 0 || erroEmissao) && (
        <div className="mb-4 rounded border border-slate-200 bg-slate-50 p-3 text-sm print:hidden">
          {notas.map((nota) => (
            <div key={nota.id} className="border-b border-slate-200 py-1.5 last:border-0">
            <div className="flex items-center justify-between">
              <span className="text-slate-600">{nota.tipo.toUpperCase()}</span>
              <span className="flex items-center gap-2">
                {(nota.tipo === "nfce" || nota.tipo === "nfe") && nota.status === "authorized" && (
                  <a
                    href={`/api/proxy/notas-fiscais/${nota.id}/danfe`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Baixar DANFE
                  </a>
                )}
                {(nota.tipo === "nfce" || nota.tipo === "nfe") && nota.status === "authorized" && (
                  <a
                    href={`/api/proxy/notas-fiscais/${nota.id}/xml`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Baixar XML
                  </a>
                )}
                {(nota.tipo === "nfce" || nota.tipo === "nfe") && nota.status === "authorized" && (
                  <button
                    onClick={() => cancelarNota(nota)}
                    disabled={cancelandoId === nota.id}
                    className="text-xs text-red-600 hover:underline disabled:opacity-50"
                  >
                    {cancelandoId === nota.id ? "Cancelando..." : "Cancelar"}
                  </button>
                )}
                {nota.url_danfe && (
                  <a
                    href={nota.url_danfe}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Ver nota (SEFAZ)
                  </a>
                )}
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    nota.status === "authorized"
                      ? "bg-emerald-100 text-emerald-700"
                      : nota.status === "rejected"
                        ? "bg-red-100 text-red-700"
                        : nota.status === "canceled"
                          ? "bg-slate-200 text-slate-600"
                          : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {nota.status === "authorized"
                    ? "Autorizada"
                    : nota.status === "rejected"
                      ? "Rejeitada"
                      : nota.status === "canceled"
                        ? "Cancelada"
                        : nota.status}
                </span>
              </span>
            </div>
            {nota.status === "rejected" && nota.mensagem_retorno && (
              <p className="mt-1 text-xs text-red-600">{nota.mensagem_retorno}</p>
            )}
            </div>
          ))}
          {erroEmissao && (
            <p className="mt-1 flex items-center gap-1.5 text-xs text-red-600">
              <AlertCircle className="h-3.5 w-3.5" />
              {erroEmissao}
            </p>
          )}
          {erroCancelamento && (
            <p className="mt-1 flex items-center gap-1.5 text-xs text-red-600">
              <AlertCircle className="h-3.5 w-3.5" />
              {erroCancelamento}
            </p>
          )}
        </div>
      )}

      <div className="mb-4 grid grid-cols-2 gap-3 text-sm text-slate-600">
        <div>
          <span className="block text-xs text-slate-400">Data</span>
          {new Date(venda.created_at).toLocaleString("pt-BR")}
        </div>
        <div>
          <span className="block text-xs text-slate-400">Status</span>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cancelada ? "bg-slate-200 text-slate-600" : "bg-emerald-100 text-emerald-700"}`}>
            {cancelada ? "Cancelada" : "Concluída"}
          </span>
        </div>
        <div>
          <span className="block text-xs text-slate-400">Origem</span>
          <BadgeOrigem venda={venda} />
        </div>
        <div>
          <span className="block text-xs text-slate-400">Cliente</span>
          {venda.cliente?.nome ?? "não informado"}
        </div>
        <div>
          <span className="block text-xs text-slate-400">Vendedor</span>
          {nomeVendedor}
        </div>
      </div>

      <p className="mb-2 text-sm font-medium text-slate-600">Itens</p>
      <div className="mb-4 max-h-52 overflow-auto rounded border border-slate-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr className="divide-x divide-slate-200">
              <th className="px-3 py-2">Produto</th>
              <th className="px-3 py-2">Qtd.</th>
              <th className="px-3 py-2">Preço unit.</th>
              <th className="px-3 py-2">Total</th>
            </tr>
          </thead>
          <tbody>
            {venda.itens.map((item) => (
              <tr key={item.id} className="divide-x divide-slate-200 border-t border-slate-200 text-slate-900">
                <td className="px-3 py-2">{item.produto?.descricao ?? item.servico?.descricao ?? `#${item.produto_id ?? item.servico_id}`}</td>
                <td className="px-3 py-2">{Number(item.quantidade)}</td>
                <td className="px-3 py-2">R$ {Number(item.preco_unitario).toFixed(2)}</td>
                <td className="px-3 py-2">R$ {Number(item.total).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mb-2 text-sm font-medium text-slate-600">Pagamentos</p>
      <ul className="mb-4 divide-y divide-slate-200 rounded border border-slate-200">
        {venda.pagamentos.map((pagamento) => (
          <li key={pagamento.id} className="flex justify-between px-3 py-2 text-sm text-slate-900">
            <span>{ROTULO_FORMA[pagamento.forma_pagamento]}</span>
            <span>R$ {Number(pagamento.valor).toFixed(2)}</span>
          </li>
        ))}
      </ul>

      <div className="rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>R$ {Number(venda.subtotal).toFixed(2)}</span>
        </div>
        {Number(venda.desconto) > 0 && (
          <div className="flex justify-between text-amber-600">
            <span>Desconto</span>
            <span>-R$ {Number(venda.desconto).toFixed(2)}</span>
          </div>
        )}
        <div className="mt-1 flex justify-between border-t border-slate-200 pt-1 text-base font-semibold text-slate-900">
          <span>Total</span>
          <span>R$ {Number(venda.total).toFixed(2)}</span>
        </div>
      </div>

      {/*
        MenuModal fica dentro do wrapper "print:hidden" do pdv-screen — um
        Cupom aninhado ali dentro nunca apareceria na impressão, porque
        display:none no ancestral vence o print:block do próprio Cupom. Um
        portal pro body escapa dessa árvore, igual ao cupom da venda recém-
        concluída (que fica fora do wrapper de propósito).
      */}
      {typeof document !== "undefined" && createPortal(<Cupom venda={vendaParaCupom(venda)} />, document.body)}
    </div>
  );
}
