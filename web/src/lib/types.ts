export type Produto = {
  id: number;
  codigo_barras: string | null;
  codigo_interno: string | null;
  descricao: string;
  unidade: string;
  preco_venda: string;
  quantidade_estoque?: number;
  estoques?: { loja_id: number; quantidade: number }[];
};

export type Cliente = {
  id: number;
  nome: string;
  cpf_cnpj: string | null;
};

export type Loja = {
  id: number;
  nome: string;
  cnpj: string | null;
  endereco: string | null;
  ativo: boolean;
};

export type FormaPagamento =
  | "boleto"
  | "cartao"
  | "dinheiro"
  | "cheque"
  | "crediario"
  | "pix"
  | "outros"
  | "a_prazo";

// Ordem e teclas idênticas à tela de referência: B-Boleto C-Cartão D-Dinheiro H-Cheque N-Crediário P-Pix A-A Prazo O-Outros
export const FORMAS_PAGAMENTO: { valor: FormaPagamento; rotulo: string; tecla: string }[] = [
  { valor: "boleto", rotulo: "Boleto", tecla: "B" },
  { valor: "cartao", rotulo: "Cartão", tecla: "C" },
  { valor: "dinheiro", rotulo: "Dinheiro", tecla: "D" },
  { valor: "cheque", rotulo: "Cheque", tecla: "H" },
  { valor: "crediario", rotulo: "Crediário", tecla: "N" },
  { valor: "pix", rotulo: "Pix", tecla: "P" },
  { valor: "a_prazo", rotulo: "A Prazo", tecla: "A" },
  { valor: "outros", rotulo: "Outros", tecla: "O" },
];
