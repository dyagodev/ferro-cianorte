import type { FormaPagamento } from "@/lib/types";

export type VendaConcluida = {
  id: number;
  dataHora: string;
  lojaNome: string;
  vendedorNome: string;
  clienteNome: string;
  itens: { descricao: string; quantidade: number; precoOriginal: number; precoUnitario: number }[];
  pagamentos: { forma_pagamento: FormaPagamento; valor: number }[];
  subtotal: number;
  desconto: number;
  total: number;
};

const ROTULO_FORMA_PAGAMENTO: Record<FormaPagamento, string> = {
  boleto: "Boleto",
  cartao: "Cartão",
  dinheiro: "Dinheiro",
  cheque: "Cheque",
  crediario: "Crediário",
  pix: "Pix",
};

export default function Cupom({ venda }: { venda: VendaConcluida }) {
  return (
    <div className="hidden print:block print:w-[80mm] print:text-black print:text-xs">
      <p className="text-center font-bold">{venda.lojaNome}</p>
      <p className="text-center">Cupom não fiscal</p>
      <p className="mt-2">Venda: #{venda.id}</p>
      <p>Data: {new Date(venda.dataHora).toLocaleString("pt-BR")}</p>
      <p>Vendedor: {venda.vendedorNome}</p>
      <p>Cliente: {venda.clienteNome}</p>

      <hr className="my-2 border-black" />

      {venda.itens.map((item, index) => (
        <div key={index} className="mb-1">
          <p>{item.descricao}</p>
          <div className="flex justify-between">
            <span>
              {item.quantidade} x {item.precoUnitario.toFixed(2)}
              {item.precoOriginal !== item.precoUnitario && (
                <span className="ml-1 line-through">(R$ {item.precoOriginal.toFixed(2)})</span>
              )}
            </span>
            <span>R$ {(item.quantidade * item.precoUnitario).toFixed(2)}</span>
          </div>
        </div>
      ))}

      <hr className="my-2 border-black" />

      <div className="flex justify-between">
        <span>Subtotal</span>
        <span>R$ {venda.subtotal.toFixed(2)}</span>
      </div>
      {venda.desconto > 0 && (
        <div className="flex justify-between">
          <span>Desconto</span>
          <span>-R$ {venda.desconto.toFixed(2)}</span>
        </div>
      )}
      <div className="flex justify-between font-bold">
        <span>Total</span>
        <span>R$ {venda.total.toFixed(2)}</span>
      </div>

      <div className="mt-2">
        {venda.pagamentos.map((pagamento, index) => (
          <div key={index} className="flex justify-between">
            <span>{ROTULO_FORMA_PAGAMENTO[pagamento.forma_pagamento]}</span>
            <span>R$ {pagamento.valor.toFixed(2)}</span>
          </div>
        ))}
      </div>

      <p className="mt-4 text-center">Obrigado pela preferência!</p>
    </div>
  );
}
