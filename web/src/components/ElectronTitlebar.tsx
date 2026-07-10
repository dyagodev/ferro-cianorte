"use client";

import { Minus, Square, X } from "lucide-react";
import { useEffect, useState } from "react";

declare global {
  interface Window {
    electronAPI?: {
      isElectron: true;
      minimizeToBubble: () => void;
      toggleMaximize: () => void;
      platform: () => Promise<string>;
    };
  }
}

/**
 * Barra de título só existe dentro do app desktop (Electron), já que ali a
 * janela é sem moldura (frame: false) — no navegador isso não renderiza nada.
 */
export function ElectronTitlebar() {
  const [isElectron, setIsElectron] = useState(false);

  useEffect(() => {
    setIsElectron(Boolean(window.electronAPI?.isElectron));
  }, []);

  if (!isElectron) return null;

  return (
    <div
      className="flex h-9 shrink-0 items-center justify-between bg-slate-900 pl-3 text-white"
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
    >
      <span className="text-xs font-medium tracking-wide text-slate-300">Ferro Cianorte</span>
      <div className="flex h-full" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
        <button
          type="button"
          onClick={() => window.electronAPI?.minimizeToBubble()}
          className="flex h-full w-11 items-center justify-center hover:bg-white/10"
          title="Minimizar para bolha"
        >
          <Minus className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => window.electronAPI?.toggleMaximize()}
          className="flex h-full w-11 items-center justify-center hover:bg-white/10"
          title="Maximizar"
        >
          <Square className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => window.electronAPI?.minimizeToBubble()}
          className="flex h-full w-11 items-center justify-center hover:bg-red-600"
          title="Fechar (minimiza para a bolha — clique com o botão direito na bolha pra sair de verdade)"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
