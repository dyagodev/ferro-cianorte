export type Produto = {
  id: number;
  codigo_barras: string | null;
  codigo_interno: string | null;
  descricao: string;
  unidade: string;
  preco_venda: string;
  preco_custo?: string;
  grupo_fiscal_id: number | null;
  grupo_fiscal?: GrupoFiscal | null;
  quantidade_estoque?: number | string;
  estoques?: { loja_id: number; quantidade: number | string; ativo: boolean }[];
};

// Serviço é entidade própria, separada de Produto (sem estoque/custo).
export type Servico = {
  id: number;
  descricao: string;
  codigo_servico_municipal: string | null;
  aliquota_iss: string | null;
  preco_venda: string;
  ativo: boolean;
};

// Usado nos 3 lugares que lidam com carrinho/itens que podem ser produto
// OU serviço (PDV, Ordem de Serviço nova/detalhe) — evita duplicar a união
// discriminada em cada tela.
export type ItemVendavel = { tipo: "produto"; item: Produto } | { tipo: "servico"; item: Servico };

export type GrupoFiscal = {
  id: number;
  nome: string;
  ncm: string | null;
  cfop_dentro_estado: string | null;
  cfop_fora_estado: string | null;
  csosn: string | null;
  cst_icms: string | null;
  percentual_reducao_bc: string | null;
  aliquota_icms: string | null;
  cst_pis: string | null;
  aliquota_pis: string | null;
  cst_cofins: string | null;
  aliquota_cofins: string | null;
  cst_ibscbs: string | null;
  cclasstrib_ibscbs: string | null;
};

export type Cliente = {
  id: number;
  nome: string;
  cpf_cnpj: string | null;
  inscricao_estadual: string | null;
  telefone: string | null;
  endereco: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  codigo_municipio: string | null;
};

export type Ativo = {
  id: number;
  cliente_id: number;
  tipo: string | null;
  nome: string;
  identificador: string | null;
  observacoes: string | null;
  ativo: boolean;
  cliente?: { id: number; nome: string } | null;
};

export type StatusOrdemServico = "aberta" | "em_execucao" | "concluida" | "cancelada" | "faturada";

export type OrdemServicoItem = {
  id: number;
  ordem_servico_id: number;
  produto_id: number | null;
  servico_id: number | null;
  quantidade: string | number;
  preco_unitario: string;
  total: string;
  produto?: { id: number; descricao: string } | null;
  servico?: { id: number; descricao: string } | null;
};

export type OrdemServico = {
  id: number;
  loja_id: number;
  cliente_id: number;
  ativo_id: number | null;
  user_id: number;
  profissional_id: number | null;
  status: StatusOrdemServico;
  descricao_problema: string | null;
  observacoes: string | null;
  data_abertura: string;
  data_previsao: string | null;
  data_conclusao: string | null;
  venda_id: number | null;
  subtotal: string;
  desconto: string;
  total: string;
  itens?: OrdemServicoItem[];
  itens_count?: number;
  cliente?: { id: number; nome: string } | null;
  ativo?: { id: number; nome: string; tipo: string | null } | null;
  loja?: { id: number; nome: string } | null;
  usuario?: { id: number; name: string } | null;
  profissional?: { id: number; name: string } | null;
  venda?: Venda | null;
};

export type Loja = {
  id: number;
  nome: string;
  cnpj: string | null;
  inscricao_estadual: string | null;
  razao_social: string | null;
  endereco: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  codigo_municipio: string | null;
  uf: string | null;
  ativo: boolean;
  spedy_ambiente: string | null;
  spedy_company_id: string | null;
  spedy_serie_nfce: string | null;
  possui_spedy_proprio: boolean;
  possui_certificado: boolean;
  mdfe_ambiente: string | null;
  mdfe_rntrc: string | null;
  mdfe_proximo_numero: number;
  possui_mdfe_configurado: boolean;
  emissao_fiscal_modo: "spedy" | "direta";
  nfce_ambiente: string | null;
  nfce_csc_id: string | null;
  nfce_serie: string | null;
  nfce_proximo_numero: number;
  possui_nfce_configurado: boolean;
  possui_nfce_csc: boolean;
  nfe_ambiente: string | null;
  nfe_serie: string | null;
  possui_nfe_configurado: boolean;
  possui_emissao_fiscal_configurada: boolean;
};

export type Veiculo = {
  id: number;
  placa: string;
  renavam: string | null;
  tara_kg: number;
  capacidade_kg: number | null;
  capacidade_m3: number | null;
  tipo_rodado: string | null;
  tipo_carroceria: string | null;
  uf: string | null;
  tipo: "tracao" | "reboque";
  ativo: boolean;
};

export type Condutor = {
  id: number;
  nome: string;
  cpf: string;
  ativo: boolean;
};

export type ManifestoDocumentoTransporte = {
  id: number;
  tipo: "nfe" | "cte";
  chave: string;
};

export type StatusManifesto = "rascunho" | "enviado" | "autorizado" | "rejeitado" | "encerrado" | "cancelado";

export type ManifestoTransporte = {
  id: number;
  loja_id: number;
  veiculo_tracao_id: number;
  status: StatusManifesto;
  tp_emitente: "1" | "2" | "3";
  numero: number;
  serie: string;
  chave_acesso: string | null;
  protocolo: string | null;
  uf_ini: string;
  uf_fim: string;
  municipio_carregamento_codigo: string;
  municipio_carregamento_nome: string;
  municipio_descarga_codigo: string;
  municipio_descarga_nome: string;
  tipo_carga: string;
  descricao_produto: string;
  ncm: string | null;
  valor_carga: string;
  peso_carga_kg: string;
  dh_inicio_viagem: string | null;
  dh_emissao: string | null;
  codigo_retorno: string | null;
  mensagem_retorno: string | null;
  created_at: string;
  loja?: Loja;
  veiculo_tracao?: Veiculo;
  documentos?: ManifestoDocumentoTransporte[];
  condutores?: Condutor[];
  reboques?: Veiculo[];
};

export type Municipio = {
  id: number;
  codigo_ibge: string;
  nome: string;
  uf: string;
};

export type NotaFiscal = {
  id: number;
  tipo: "nfce" | "nfe" | "nfse";
  status: string;
  chave_acesso: string | null;
  numero: string | null;
  serie: string | null;
  url_danfe: string | null;
  url_xml: string | null;
  codigo_retorno: string | null;
  mensagem_retorno: string | null;
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
  produto_id: number | null;
  servico_id: number | null;
  quantidade: string | number;
  preco_original: string;
  preco_unitario: string;
  total: string;
  produto: { descricao: string } | null;
  servico?: { descricao: string } | null;
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
  loja: { nome: string; id?: number } | null;
  itens: VendaItem[];
  pagamentos: VendaPagamento[];
  notas_fiscais?: NotaFiscal[];
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

export type StatusTransferencia = "rascunho" | "em_transito" | "recebida" | "cancelada";

export type TransferenciaItem = {
  id: number;
  produto_id: number;
  produto?: Produto;
  quantidade: string;
  preco_unitario: string;
};

export type TransferenciaEstoque = {
  id: number;
  loja_origem_id: number;
  loja_destino_id: number;
  loja_origem?: { id: number; nome: string };
  loja_destino?: { id: number; nome: string };
  status: StatusTransferencia;
  observacao: string | null;
  usuario?: { id: number; name: string };
  recebido_por?: { id: number; name: string } | null;
  recebido_em: string | null;
  nota_fiscal_id: number | null;
  nota_fiscal?: NotaFiscal | null;
  manifesto_transporte_id: number | null;
  itens?: TransferenciaItem[];
  itens_count?: number;
  created_at: string;
};

export type TipoMovimentacaoEstoque =
  | "venda"
  | "cancelamento_venda"
  | "transferencia_saida"
  | "transferencia_entrada"
  | "transferencia_estorno"
  | "sincronizacao_linkpro"
  | "reconciliacao_linkpro"
  | "ajuste_manual";

export type MovimentacaoEstoque = {
  id: number;
  produto_id: number;
  produto?: { id: number; descricao: string; codigo_interno: string | null };
  loja_id: number;
  loja?: { id: number; nome: string };
  quantidade_antes: string;
  quantidade_depois: string;
  delta: number;
  tipo: TipoMovimentacaoEstoque;
  origem_tipo: string | null;
  origem_id: number | null;
  usuario?: { id: number; name: string } | null;
  observacao: string | null;
  created_at: string;
};
