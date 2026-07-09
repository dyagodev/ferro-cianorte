"use client";

import { PackageSearch, PackageX, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/apiClient";
import type { Produto } from "@/lib/types";

export default function ProdutoModal({
  lojaId,
  onFechar,
  onSelecionar,
}: {
  lojaId: number | null;
  onFechar: () => void;
  onSelecionar: (produto: Produto) => void;
}) {
  const [busca, setBusca] = useState("");
  const [resultados, setResultados] = useState<Produto[]>([]);
  const [carregando, setCarregando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setCarregando(true);
    const timer = setTimeout(() => {
      const query = new URLSearchParams();
      if (busca.trim()) query.set("q", busca.trim());
      if (lojaId) query.set("loja_id", String(lojaId));
      apiFetch<Produto[]>(`produtos?${query.toString()}`)
        .then(setResultados)
        .finally(() => setCarregando(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [busca, lojaId]);

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/60" onKeyDown={(e) => e.key === "Escape" && onFechar()}>
      <div className="w-full max-w-2xl rounded-lg border border-slate-300 bg-slate-50 p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-xl font-semibold text-slate-900">
            <PackageSearch className="h-5 w-5 text-blue-600" />
            F3 - Buscar Produto
          </h2>
          <button onClick={onFechar} className="flex items-center gap-1 text-slate-500 hover:text-slate-900">
            <X className="h-4 w-4" />
            Esc - Fechar
          </button>
        </div>

        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            ref={inputRef}
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Digite parte do nome ou código de barras (deixe vazio para listar todos)..."
            className="w-full rounded border border-slate-300 bg-white py-2 pl-9 pr-3 text-slate-900 outline-none focus:border-blue-500"
          />
        </div>

        {carregando && <p className="mb-2 text-sm text-slate-500">Buscando...</p>}

        <div className="max-h-96 overflow-auto rounded border border-slate-200">
          <table className="w-full text-left text-slate-900">
            <thead className="sticky top-0 bg-slate-50 text-sm text-slate-500">
              <tr>
                <th className="px-3 py-2">Código</th>
                <th className="px-3 py-2">Descrição</th>
                <th className="px-3 py-2">Estoque</th>
                <th className="px-3 py-2">Preço R$</th>
              </tr>
            </thead>
            <tbody>
              {resultados.length === 0 && !carregando && (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-slate-500">
                    <PackageX className="mx-auto mb-2 h-8 w-8 text-slate-300" />
                    Nenhum produto encontrado.
                  </td>
                </tr>
              )}
              {resultados.map((produto) => (
                <tr key={produto.id} className="cursor-pointer border-t border-slate-200 hover:bg-slate-100" onClick={() => onSelecionar(produto)}>
                  <td className="px-3 py-2 text-slate-500">{produto.codigo_barras ?? produto.id}</td>
                  <td className="px-3 py-2">{produto.descricao}</td>
                  <td className="px-3 py-2">
                    <span className={produto.quantidade_estoque !== undefined && produto.quantidade_estoque <= 0 ? "text-red-600" : ""}>
                      {produto.quantidade_estoque ?? "—"}
                    </span>
                  </td>
                  <td className="px-3 py-2">{Number(produto.preco_venda).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
