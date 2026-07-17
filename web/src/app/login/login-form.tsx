"use client";

import { AlertCircle, Lock, LogIn, Mail } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setErro(null);
    setCarregando(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();

      if (!response.ok) {
        setErro(data.message ?? "Não foi possível entrar.");
        return;
      }

      const destino = searchParams.get("next") ?? (data.user.role === "admin" ? "/admin" : "/pdv");
      router.push(destino);
      router.refresh();
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center bg-white">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-lg border border-slate-200 bg-slate-50 p-8 shadow-xl"
      >
        <Image src="/logo-dm-nexus.png" alt="DM Nexus" width={1228} height={235} className="mb-1 h-auto w-56" priority />
        <p className="mb-6 text-sm text-slate-500">Entre com seu usuário para acessar o caixa.</p>

        <label className="mb-1 block text-sm text-slate-600" htmlFor="email">
          E-mail
        </label>
        <div className="relative mb-4">
          <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            id="email"
            type="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded border border-slate-300 bg-white py-2 pl-9 pr-3 text-slate-900 outline-none focus:border-blue-500"
          />
        </div>

        <label className="mb-1 block text-sm text-slate-600" htmlFor="password">
          Senha
        </label>
        <div className="relative mb-4">
          <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded border border-slate-300 bg-white py-2 pl-9 pr-3 text-slate-900 outline-none focus:border-blue-500"
          />
        </div>

        {erro && (
          <p className="mb-4 flex items-center gap-1.5 text-sm text-red-600">
            <AlertCircle className="h-4 w-4" />
            {erro}
          </p>
        )}

        <button
          type="submit"
          disabled={carregando}
          className="flex w-full items-center justify-center gap-2 rounded bg-blue-600 py-2 font-medium text-white transition hover:bg-blue-500 disabled:opacity-60"
        >
          <LogIn className="h-4 w-4" />
          {carregando ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}
