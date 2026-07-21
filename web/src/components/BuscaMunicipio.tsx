"use client";

import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/apiClient";
import type { Municipio } from "@/lib/types";

/**
 * Busca de município (nome -> código IBGE), com acento ou sem — usada em
 * qualquer form que precise de cMun/cMunCarrega/cMunDescarga (Loja,
 * ManifestoTransporte) pra não depender do operador saber o código IBGE de
 * cabeça. Busca local, ver App\Http\Controllers\Api\MunicipioController.
 */
export function BuscaMunicipio({
  ufFiltro,
  onSelecionar,
  placeholder = "Buscar cidade...",
}: {
  ufFiltro?: string;
  onSelecionar: (municipio: Municipio) => void;
  placeholder?: string;
}) {
  const [termo, setTermo] = useState("");
  const [resultados, setResultados] = useState<Municipio[]>([]);

  useEffect(() => {
    const busca = termo.trim();
    if (busca.length < 2) {
      setResultados([]);
      return;
    }
    const timer = setTimeout(() => {
      const query = new URLSearchParams({ q: busca });
      if (ufFiltro) query.set("uf", ufFiltro);
      apiFetch<Municipio[]>(`municipios?${query.toString()}`).then(setResultados);
    }, 250);
    return () => clearTimeout(timer);
  }, [termo, ufFiltro]);

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        value={termo}
        onChange={(e) => setTermo(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-blue-500"
      />
      {resultados.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded border border-slate-300 bg-white shadow-lg">
          {resultados.map((municipio) => (
            <li key={municipio.id}>
              <button
                type="button"
                onClick={() => {
                  onSelecionar(municipio);
                  setTermo("");
                  setResultados([]);
                }}
                className="w-full px-3 py-2 text-left text-sm hover:bg-slate-100"
              >
                {municipio.nome} — {municipio.uf}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
