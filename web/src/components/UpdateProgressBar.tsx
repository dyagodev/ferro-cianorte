"use client";

import { DownloadCloud } from "lucide-react";
import { useEffect, useState } from "react";
import type { StatusAtualizacao } from "./ElectronTitlebar";

/**
 * Enquanto baixa: barra fina de progresso global, logo abaixo da barra de
 * título — mesma ideia do carregamento de página do YouTube, discreta de
 * propósito pra não competir com a tela de venda. Quando fica pronta, vira
 * uma faixa visível com botão de verdade — a barra de 3px sozinha passava
 * despercebida, obrigando quem quisesse atualizar a caçar isso dentro do
 * menu (Ctrl+M). Só existe dentro do app desktop (Electron); no navegador
 * não renderiza nada, igual ao ElectronTitlebar.
 */
export function UpdateProgressBar() {
  const [status, setStatus] = useState<StatusAtualizacao | null>(null);

  useEffect(() => {
    if (!window.electronAPI?.isElectron) return;
    return window.electronAPI.onStatusAtualizacao(setStatus);
  }, []);

  if (!status || status.estado === "atualizado" || status.estado === "erro") return null;

  if (status.estado === "pronto") {
    return (
      <button
        onClick={() => window.electronAPI?.instalarAtualizacao()}
        className="flex w-full shrink-0 items-center justify-center gap-2 bg-emerald-600 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 print:hidden"
      >
        <DownloadCloud className="h-3.5 w-3.5" />
        Atualização v{status.versao} pronta — clique para reiniciar e atualizar
      </button>
    );
  }

  const percentual = status.estado === "baixando" ? status.percentual : null;

  return (
    <div className="relative h-[3px] w-full shrink-0 overflow-hidden bg-slate-100 print:hidden">
      <div
        className={`h-full bg-blue-600 ${percentual === null ? "animate-update-bar w-1/3" : "transition-[width] duration-300 ease-out"}`}
        style={percentual !== null ? { width: `${percentual}%` } : undefined}
      />
    </div>
  );
}
