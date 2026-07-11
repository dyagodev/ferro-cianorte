"use client";

import { X, type LucideIcon } from "lucide-react";

export function ModalCadastro({
  titulo,
  icone: Icone,
  onFechar,
  children,
}: {
  titulo: string;
  icone: LucideIcon;
  onFechar: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-20 flex items-center justify-center bg-black/60"
      onKeyDown={(e) => e.key === "Escape" && onFechar()}
    >
      <div className="w-full max-w-lg rounded-lg border border-slate-300 bg-slate-50 p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-xl font-semibold text-slate-900">
            <Icone className="h-5 w-5 text-blue-600" />
            {titulo}
          </h2>
          <button onClick={onFechar} className="flex items-center gap-1 text-slate-500 hover:text-slate-900">
            <X className="h-4 w-4" />
            Esc - Fechar
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
