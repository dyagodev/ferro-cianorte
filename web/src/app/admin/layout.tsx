"use client";

import {
  BarChart3,
  LayoutDashboard,
  Package,
  Receipt,
  ShoppingBag,
  Store,
  Truck,
  Users,
  UsersRound,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ABAS = [
  { href: "/admin", rotulo: "Início", icone: LayoutDashboard },
  { href: "/admin/lojas", rotulo: "Lojas", icone: Store },
  { href: "/admin/produtos", rotulo: "Produtos / Estoque", icone: Package },
  { href: "/admin/clientes", rotulo: "Clientes", icone: Users },
  { href: "/admin/fornecedores", rotulo: "Fornecedores", icone: Truck },
  { href: "/admin/grupos-fiscais", rotulo: "Grupos Fiscais", icone: Receipt },
  { href: "/admin/funcionarios", rotulo: "Funcionários", icone: UsersRound },
  { href: "/admin/relatorios", rotulo: "Relatórios", icone: BarChart3 },
];

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
          {ABAS.map((aba) => {
            const ativo = aba.href === "/admin" ? pathname === "/admin" : pathname.startsWith(aba.href);
            const Icone = aba.icone;
            return (
              <Link
                key={aba.href}
                href={aba.href}
                className={`flex items-center gap-1.5 rounded-t px-3 py-1.5 ${
                  ativo
                    ? "border-b-2 border-blue-600 font-medium text-blue-600"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <Icone className="h-4 w-4" />
                {aba.rotulo}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="flex-1 p-4">{children}</main>
    </div>
  );
}
