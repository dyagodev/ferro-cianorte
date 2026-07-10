"use client";

type Props = {
  value: number;
  onChange: (valor: number) => void;
  className?: string;
  placeholder?: string;
  autoFocus?: boolean;
};

function formatarReais(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * Campo de dinheiro com máscara: todo dígito digitado entra como centavo (da
 * direita pra esquerda), sempre mostrando "R$ 0,00" formatado — igual
 * caixa eletrônico/maquininha, sem precisar digitar vírgula nem ponto.
 */
export function CampoDinheiro({ value, onChange, className, placeholder, autoFocus }: Props) {
  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const digitos = event.target.value.replace(/\D/g, "");
    const centavos = Number(digitos || "0");
    onChange(centavos / 100);
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      autoFocus={autoFocus}
      value={formatarReais(Math.round(value * 100))}
      onChange={handleChange}
      placeholder={placeholder}
      className={className}
    />
  );
}
