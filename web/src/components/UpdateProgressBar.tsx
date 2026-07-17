"use client";

import { useEffect, useState } from "react";
import type { StatusAtualizacao } from "./ElectronTitlebar";

/**
 * Barra fina de progresso global, logo abaixo da barra de título (onde
 * ficam minimizar/fechar) — mesma ideia do carregamento de página do
 * YouTube. Só existe dentro do app desktop (Electron); no navegador não
 * renderiza nada, igual ao ElectronTitlebar.
 */
export function UpdateProgressBar() {
  const [status, setStatus] = useState<StatusAtualizacao | null>(null);

  useEffect(() => {
    if (!window.electronAPI?.isElectron) return;
    return window.electronAPI.onStatusAtualizacao(setStatus);
  }, []);

  if (!status || status.estado === "atualizado" || status.estado === "erro") return null;

  const pronto = status.estado === "pronto";
  const percentual = status.estado === "baixando" ? status.percentual : null;
  const indeterminado = percentual === null && !pronto;

  return (
    <div
      className={`relative h-[3px] w-full shrink-0 overflow-hidden bg-slate-100 ${pronto ? "cursor-pointer" : ""}`}
      onClick={() => pronto && window.electronAPI?.instalarAtualizacao()}
      title={pronto ? "Atualização pronta — clique para reiniciar e instalar" : undefined}
    >
      <div
        className={`h-full bg-blue-600 ${pronto ? "!bg-emerald-500" : ""} ${indeterminado ? "animate-update-bar w-1/3" : "transition-[width] duration-300 ease-out"}`}
        style={percentual !== null ? { width: `${percentual}%` } : pronto ? { width: "100%" } : undefined}
      />
    </div>
  );
}
