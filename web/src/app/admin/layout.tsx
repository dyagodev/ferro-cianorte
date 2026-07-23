"use client";

import {
  ArrowRightLeft,
  BarChart3,
  Car,
  ChevronDown,
  ClipboardList,
  FileCheck2,
  IdCard,
  LayoutDashboard,
  Package,
  PawPrint,
  Receipt,
  Route,
  ShoppingBag,
  Store,
  Truck,
  Users,
  UsersRound,
  Wrench,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type ItemMenu = { href: string; rotulo: string; icone: React.ComponentType<{ className?: string }> };

// Item solto (sem categoria) ou grupo com dropdown — grupo precisa de mais
// de uma tela pra valer a pena o clique extra, senão vira link direto.
type EntradaMenu = ItemMenu | { rotulo: string; icone: ItemMenu["icone"]; itens: ItemMenu[] };

const MENU: EntradaMenu[] = [
  { href: "/admin", rotulo: "Início", icone: LayoutDashboard },
  {
    rotulo: "Cadastros",
    icone: ClipboardList,
    itens: [
      { href: "/admin/lojas", rotulo: "Lojas", icone: Store },
      { href: "/admin/produtos", rotulo: "Produtos / Estoque", icone: Package },
      { href: "/admin/clientes", rotulo: "Clientes", icone: Users },
      { href: "/admin/fornecedores", rotulo: "Fornecedores", icone: Truck },
      { href: "/admin/funcionarios", rotulo: "Funcionários", icone: UsersRound },
    ],
  },
  {
    rotulo: "Fiscal",
    icone: Receipt,
    itens: [
      { href: "/admin/grupos-fiscais", rotulo: "Grupos Fiscais", icone: Receipt },
      { href: "/admin/notas-fiscais", rotulo: "Notas Fiscais", icone: FileCheck2 },
    ],
  },
  {
    rotulo: "Serviços",
    icone: Wrench,
    itens: [
      { href: "/admin/ordens-servico", rotulo: "Ordens de Serviço", icone: Wrench },
      { href: "/admin/ativos", rotulo: "Ativos", icone: PawPrint },
    ],
  },
  {
    rotulo: "Logística",
    icone: ArrowRightLeft,
    itens: [
      { href: "/admin/transferencias", rotulo: "Transferências", icone: ArrowRightLeft },
      { href: "/admin/manifestos-transporte", rotulo: "MDF-e", icone: Route },
      { href: "/admin/veiculos", rotulo: "Veículos", icone: Car },
      { href: "/admin/condutores", rotulo: "Condutores", icone: IdCard },
    ],
  },
  { href: "/admin/relatorios", rotulo: "Relatórios", icone: BarChart3 },
];

function ehItem(entrada: EntradaMenu): entrada is ItemMenu {
  return "href" in entrada;
}

function itemAtivo(href: string, pathname: string): boolean {
  return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
}

function GrupoDropdown({
  grupo,
  pathname,
}: {
  grupo: Extract<EntradaMenu, { itens: ItemMenu[] }>;
  pathname: string;
}) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const Icone = grupo.icone;
  const algumAtivo = grupo.itens.some((item) => itemAtivo(item.href, pathname));

  useEffect(() => {
    function fecharSeForaDoMenu(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setAberto(false);
      }
    }
    document.addEventListener("mousedown", fecharSeForaDoMenu);
    return () => document.removeEventListener("mousedown", fecharSeForaDoMenu);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setAberto((atual) => !atual)}
        className={`flex items-center gap-1.5 rounded-t px-3 py-1.5 ${
          algumAtivo
            ? "border-b-2 border-blue-600 font-medium text-blue-600"
            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        }`}
      >
        <Icone className="h-4 w-4" />
        {grupo.rotulo}
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${aberto ? "rotate-180" : ""}`} />
      </button>
      {aberto && (
        <div className="absolute left-0 top-full z-20 mt-1 min-w-48 rounded border border-slate-200 bg-white py-1 shadow-lg">
          {grupo.itens.map((item) => {
            const Icone = item.icone;
            const ativo = itemAtivo(item.href, pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setAberto(false)}
                className={`flex items-center gap-2 px-3 py-2 text-sm ${
                  ativo ? "bg-blue-50 font-medium text-blue-600" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <Icone className="h-4 w-4" />
                {item.rotulo}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex flex-1 flex-col bg-white">
      <header className="border-b border-slate-200 bg-slate-50 px-4 py-2 print:hidden">
        <div className="flex items-center justify-between">
          <h1 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <Image src="/logo-dm-nexus.png" alt="DM Nexus" width={1228} height={235} className="h-9 w-auto" priority />
            <span className="text-slate-400">—</span> Administrativo
          </h1>
          <Link
            href="/pdv"
            className="flex items-center gap-1.5 rounded border border-slate-300 px-3 py-1 text-sm text-slate-600 hover:bg-slate-100"
          >
            <ShoppingBag className="h-4 w-4" />
            Ir para o caixa
          </Link>
        </div>
        <nav className="mt-2 flex gap-1 text-sm">
          {MENU.map((entrada) => {
            if (ehItem(entrada)) {
              const Icone = entrada.icone;
              const ativo = itemAtivo(entrada.href, pathname);
              return (
                <Link
                  key={entrada.href}
                  href={entrada.href}
                  className={`flex items-center gap-1.5 rounded-t px-3 py-1.5 ${
                    ativo
                      ? "border-b-2 border-blue-600 font-medium text-blue-600"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <Icone className="h-4 w-4" />
                  {entrada.rotulo}
                </Link>
              );
            }
            return <GrupoDropdown key={entrada.rotulo} grupo={entrada} pathname={pathname} />;
          })}
        </nav>
      </header>
      <main className="flex-1 p-4">{children}</main>
    </div>
  );
}
