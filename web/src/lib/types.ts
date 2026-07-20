export type Produto = {
  id: number;
  codigo_barras: string | null;
  codigo_interno: string | null;
  descricao: string;
  unidade: string;
  preco_venda: string;
  grupo_fiscal_id: number | null;
  grupo_fiscal?: GrupoFiscal | null;
  quantidade_estoque?: number | string;
  estoques?: { loja_id: number; quantidade: number | string }[];
};

export type GrupoFiscal = {
  id: number;
  nome: string;
  ncm: string | null;
  cfop_dentro_estado: string | null;
  cfop_fora_estado: string | null;
  csosn: string | null;
  cst_icms: string | null;
  aliquota_icms: string | null;
  cst_pis: string | null;
  aliquota_pis: string | null;
  cst_cofins: string | null;
  aliquota_cofins: string | null;
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
  | "cartao_debito"
  | "dinheiro"
  | "cheque"
  | "crediario"
  | "pix"
  | "outros"
  | "a_prazo";

export type VendaItem = {
  id: number;
  produto_id: number;
  quantidade: string | number;
  preco_original: string;
  preco_unitario: string;
  total: string;
  produto: { descricao: string } | null;
};

export type VendaPagamento = {
  id: number;
  forma_pagamento: FormaPagamento;
  valor: string;
};

export type Venda = {
  id: number;
  uuid: string;
  created_at: string;
  status: string;
  subtotal: string;
  desconto: string;
  total: string;
  sync_conexao_id: number | null;
  cliente: { nome: string } | null;
  vendedor: { name: string };
  vendedor_externo_nome: string | null;
  loja: { nome: string };
  itens: VendaItem[];
  pagamentos: VendaPagamento[];
};

// Ordem e teclas idênticas à tela de referência: B-Boleto C-Cartão Crédito D-Dinheiro H-Cheque N-Crediário P-Pix A-A Prazo O-Outros V-Cartão Débito
export const FORMAS_PAGAMENTO: { valor: FormaPagamento; rotulo: string; tecla: string }[] = [
  { valor: "boleto", rotulo: "Boleto", tecla: "B" },
  { valor: "cartao", rotulo: "Cartão Crédito", tecla: "C" },
  { valor: "cartao_debito", rotulo: "Cartão Débito", tecla: "V" },
  { valor: "dinheiro", rotulo: "Dinheiro", tecla: "D" },
  { valor: "cheque", rotulo: "Cheque", tecla: "H" },
  { valor: "crediario", rotulo: "Crediário", tecla: "N" },
  { valor: "pix", rotulo: "Pix", tecla: "P" },
  { valor: "a_prazo", rotulo: "A Prazo", tecla: "A" },
  { valor: "outros", rotulo: "Outros", tecla: "O" },
];
