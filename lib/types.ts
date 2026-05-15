// ── Categorias ────────────────────────────────────────────

export interface Categoria {
  id: string;
  nome: string;
  tipo: 'entrada' | 'despesa';
  cor: string; // hex
  icone: string; // emoji
}

// ── Planejamentos ─────────────────────────────────────────

export interface Planejamento {
  id: string;
  nome: string;
  percentual: number; // 0-100
  cor: string;
  ativo: boolean;
}

// ── Cartões ───────────────────────────────────────────────

export interface Cartao {
  id: string;
  nome: string;
  bandeira: string; // Visa, Mastercard, etc.
  cor: string; // cor do card visual
  limite: number;
  diaFechamento: number; // 1-31
  ativo: boolean;
}

// ── Despesas Fixas ────────────────────────────────────────

export interface DespesaFixa {
  id: string;
  nome: string;
  valor: number;
  tipo: 'debito' | 'credito';
  cartaoId?: string; // se crédito
  categoriaId: string;
  planejamentoId?: string;
  diaVencimento: number;
  ativa: boolean;
  // Parcelamento (só crédito)
  parcelamento?: {
    total: number;
    atual: number;
    mesInicio: string; // YYYY-MM
  };
}

// ── Lançamentos ───────────────────────────────────────────

export type TipoLancamento = 'entrada' | 'debito' | 'credito';

export interface Lancamento {
  id: string;
  tipo: TipoLancamento;
  descricao: string;
  valor: number;
  data: string; // ISO date YYYY-MM-DD
  categoriaId: string;
  planejamentoId?: string;
  cartaoId?: string; // se crédito
  fixaId?: string; // se veio de despesa fixa
  // Parcelamento
  parcela?: {
    numero: number;
    total: number;
    grupoId: string; // agrupa todas as parcelas
  };
  observacao?: string;
}

// ── Fatura ────────────────────────────────────────────────

export interface Fatura {
  cartaoId: string;
  mes: string; // YYYY-MM (mês de referência dos gastos)
  mesCobranca: string; // YYYY-MM (mês em que será paga)
  lancamentoIds: string[]; // IDs dos lançamentos de crédito
  paga: boolean;
  valorPago?: number;
  dataPagamento?: string;
}

// ── Dados do mês ──────────────────────────────────────────

export interface ReajusteMes {
  valor: number; // valor de correção (pode ser negativo)
  motivo: string;
}

export interface DadosMes {
  mes: string; // YYYY-MM
  lancamentos: Lancamento[];
  faturas: Fatura[]; // faturas a pagar neste mês
  reajuste?: ReajusteMes;
  despesasFixasGeradas: string[]; // IDs das fixas já geradas
}

// ── Config global ─────────────────────────────────────────

export interface Config {
  nomeUsuario: string;
  rendaMensal: number; // renda esperada para cálculo de %
  mesInicio: string; // YYYY-MM
  categorias: Categoria[];
  planejamentos: Planejamento[];
  cartoes: Cartao[];
  despesasFixas: DespesaFixa[];
}

// ── Resumo mensal (calculado) ─────────────────────────────

export interface ResumoMes {
  mes: string;
  totalEntradas: number;
  totalDebito: number;
  totalCreditoFatura: number; // faturas a pagar neste mês
  saldoFinal: number;
  saldoInicial: number;
  reajuste: number;
  porPlanejamento: {
    planejamentoId: string;
    planejado: number; // valor em R$ baseado no %
    real: number;
    percentualReal: number;
  }[];
  porCategoria: {
    categoriaId: string;
    total: number;
  }[];
}

// ── IA ────────────────────────────────────────────────────

export interface MensagemChat {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface LancamentoSugerido {
  tipo: TipoLancamento;
  descricao: string;
  valor: number;
  data: string;
  categoriaId?: string;
  planejamentoId?: string;
  cartaoId?: string;
  observacao?: string;
}
