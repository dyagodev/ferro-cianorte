"use client";

import { AlertCircle, CheckCircle2, FileUp, Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import { apiFetch, ApiError } from "@/lib/apiClient";

/**
 * Upload de certificado A1 (.pfx) reaproveitado em dois lugares: envio pra
 * Spedy (fica lá, não guardamos) e envio pro MDF-e (fica guardado
 * criptografado aqui, ver LojaController::enviarCertificadoMdfe).
 */
export function UploadCertificado({ endpoint, aposEnviar }: { endpoint: string; aposEnviar?: () => void }) {
  const [certificado, setCertificado] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [senha, setSenha] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [mensagem, setMensagem] = useState<{ tipo: "sucesso" | "erro"; texto: string } | null>(null);

  async function enviar() {
    if (!certificado) return;

    setEnviando(true);
    setMensagem(null);

    const dados = new FormData();
    dados.append("certificado", certificado);
    dados.append("senha_certificado", senha);

    try {
      await apiFetch(endpoint, { method: "POST", body: dados });
      setMensagem({ tipo: "sucesso", texto: "Certificado enviado com sucesso." });
      setCertificado(null);
      setSenha("");
      if (inputRef.current) inputRef.current.value = "";
      aposEnviar?.();
    } catch (e) {
      setMensagem({
        tipo: "erro",
        texto: e instanceof ApiError ? e.message : "Não foi possível enviar o certificado.",
      });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept=".pfx,.p12"
        onChange={(e) => setCertificado(e.target.files?.[0] ?? null)}
        className="hidden"
      />

      <div className="mb-2 flex items-center gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex items-center gap-1.5 whitespace-nowrap rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
        >
          <FileUp className="h-4 w-4" />
          Escolher arquivo .pfx
        </button>
        {certificado ? (
          <span className="flex items-center gap-1.5 truncate text-sm text-slate-600">
            {certificado.name}
            <button
              type="button"
              onClick={() => {
                setCertificado(null);
                if (inputRef.current) inputRef.current.value = "";
              }}
              className="text-slate-400 hover:text-red-600"
              title="Remover"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        ) : (
          <span className="text-sm text-slate-400">Nenhum arquivo selecionado</span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <input
          type="password"
          autoComplete="off"
          placeholder="Senha do certificado"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          className="col-span-2 rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
        />
        <button
          type="button"
          onClick={enviar}
          disabled={!certificado || !senha || enviando}
          className="flex items-center justify-center gap-1.5 rounded bg-slate-700 px-3 py-2 text-sm text-white hover:bg-slate-600 disabled:opacity-50"
        >
          <Upload className="h-3.5 w-3.5" />
          {enviando ? "Enviando..." : "Enviar"}
        </button>
      </div>

      {mensagem && (
        <p
          className={`mt-2 flex items-center gap-1.5 text-sm ${
            mensagem.tipo === "sucesso" ? "text-emerald-600" : "text-red-600"
          }`}
        >
          {mensagem.tipo === "sucesso" ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {mensagem.texto}
        </p>
      )}
    </div>
  );
}
