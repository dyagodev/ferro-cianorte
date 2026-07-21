"use client";

import { X, type LucideIcon } from "lucide-react";

const LARGURAS = {
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-3xl",
};

export function ModalCadastro({
  titulo,
  icone: Icone,
  onFechar,
  children,
  largura = "md",
}: {
  titulo: string;
  icone: LucideIcon;
  onFechar: () => void;
  children: React.ReactNode;
  largura?: keyof typeof LARGURAS;
}) {
  return (
    <div
      className="fixed inset-0 z-20 flex items-center justify-center bg-black/60 p-4"
      onKeyDown={(e) => e.key === "Escape" && onFechar()}
    >
      <div
        className={`flex max-h-[90vh] w-full ${LARGURAS[largura]} flex-col rounded-lg border border-slate-300 bg-slate-50 shadow-2xl`}
      >
        <div className="flex items-center justify-between border-b border-slate-200 p-6 pb-4">
          <h2 className="flex items-center gap-2 text-xl font-semibold text-slate-900">
            <Icone className="h-5 w-5 text-blue-600" />
            {titulo}
          </h2>
          <button onClick={onFechar} className="flex items-center gap-1 text-slate-500 hover:text-slate-900">
            <X className="h-4 w-4" />
            Esc - Fechar
          </button>
        </div>
        <div className="overflow-y-auto p-6 pt-4">{children}</div>
      </div>
    </div>
  );
}
