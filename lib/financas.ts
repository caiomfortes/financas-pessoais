import { DadosMes, Config, ResumoMes, Lancamento } from './types';

export function calcularResumo(dados: DadosMes, config: Config, saldoAnterior: number): ResumoMes {
  const { lancamentos, faturas, reajuste } = dados;

  const entradas = lancamentos.filter(l => l.tipo === 'entrada');
  const debitos = lancamentos.filter(l => l.tipo === 'debito');

  const totalEntradas = entradas.reduce((s, l) => s + l.valor, 0);
  const totalDebito = debitos.reduce((s, l) => s + l.valor, 0);

  // Faturas a pagar neste mês
  const totalCreditoFatura = faturas
    .filter(f => f.mesCobranca === dados.mes && !f.paga)
    .reduce((s, f) => {
      const vals = f.lancamentoIds.map(id => {
        // valor calculado via lancamentos do mês de referência
        return 0; // será preenchido pela função de cálculo de fatura
      });
      return s;
    }, 0);

  const reajusteVal = reajuste?.valor ?? 0;
  const saldoFinal = saldoAnterior + totalEntradas - totalDebito - totalCreditoFatura + reajusteVal;

  // Por planejamento — conta débito + crédito (crédito conta no mês de cobrança)
  const porPlanejamento = config.planejamentos
    .filter(p => p.ativo)
    .map(p => {
      const real = lancamentos
        .filter(l => l.planejamentoId === p.id && l.tipo === 'debito')
        .reduce((s, l) => s + l.valor, 0);
      const base = config.rendaMensal > 0 ? config.rendaMensal : totalEntradas;
      const planejado = (p.percentual / 100) * base;
      return {
        planejamentoId: p.id,
        planejado,
        real,
        percentualReal: base > 0 ? (real / base) * 100 : 0,
      };
    });

  // Por categoria
  const porCategoria = config.categorias.map(c => ({
    categoriaId: c.id,
    total: lancamentos
      .filter(l => l.categoriaId === c.id)
      .reduce((s, l) => s + l.valor, 0),
  })).filter(c => c.total > 0);

  return {
    mes: dados.mes,
    totalEntradas,
    totalDebito,
    totalCreditoFatura,
    saldoFinal,
    saldoInicial: saldoAnterior,
    reajuste: reajusteVal,
    porPlanejamento,
    porCategoria,
  };
}

export function mesAnterior(mes: string): string {
  const [y, m] = mes.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function mesProximo(mes: string): string {
  const [y, m] = mes.split('-').map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function mesAtual(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function formatarMes(mes: string): string {
  const [y, m] = mes.split('-');
  const nomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${nomes[parseInt(m) - 1]} ${y}`;
}

export function formatarMesLongo(mes: string): string {
  const [y, m] = mes.split('-');
  const nomes = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  return `${nomes[parseInt(m) - 1]} de ${y}`;
}

export function formatarValor(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Determina em qual mês uma despesa de crédito será cobrada
export function mesFatura(dataGasto: string, diaFechamento: number): string {
  const data = new Date(dataGasto + 'T12:00:00');
  const dia = data.getDate();
  // Se gasto antes ou no dia de fechamento → fatura deste mês → paga no próximo
  // Se gasto após fechamento → fatura do próximo mês → paga em dois meses
  if (dia <= diaFechamento) {
    return mesProximo(`${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`);
  } else {
    const proximo = mesProximo(`${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`);
    return mesProximo(proximo);
  }
}

// Score de planejamento (0-100)
export function calcularScore(resumo: ResumoMes): number {
  if (resumo.porPlanejamento.length === 0) return 100;
  const scores = resumo.porPlanejamento.map(p => {
    if (p.planejado === 0) return 100;
    const ratio = p.real / p.planejado;
    if (ratio <= 1) return 100;
    if (ratio <= 1.1) return 85;
    if (ratio <= 1.25) return 70;
    if (ratio <= 1.5) return 50;
    return 20;
  });
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

// Projeção do mês baseada nos dias passados
export function projetarMes(lancamentos: Lancamento[], mes: string): number {
  const hoje = new Date();
  const diaHoje = hoje.getDate();
  const diasNoMes = new Date(parseInt(mes.split('-')[0]), parseInt(mes.split('-')[1]), 0).getDate();

  const debitos = lancamentos
    .filter(l => l.tipo === 'debito')
    .reduce((s, l) => s + l.valor, 0);

  if (diaHoje === 0) return debitos;
  return (debitos / diaHoje) * diasNoMes;
}

export function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// Calcula o saldo final de um mês dado seus lançamentos e reajuste
// (sem depender de saldo anterior — soma simples das movimentações do mês)
export function calcularSaldoMes(dados: DadosMes): number {
  const entradas = dados.lancamentos.filter(l => l.tipo === 'entrada').reduce((s, l) => s + l.valor, 0);
  const saidas = dados.lancamentos.filter(l => l.tipo === 'debito').reduce((s, l) => s + l.valor, 0);
  const reajuste = dados.reajuste?.valor ?? 0;
  return entradas - saidas + reajuste;
}

// Busca o saldo acumulado até o início de um determinado mês
// percorrendo todos os meses desde mesInicio até o mês anterior ao pedido
export async function calcularSaldoAcumulado(mesPedido: string, mesInicio: string): Promise<number> {
  let saldo = 0;
  let cur = mesInicio;

  while (cur < mesPedido) {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SITE_URL || ''}/api/lancamentos?mes=${cur}`,
        { cache: 'no-store' }
      );
      if (res.ok) {
        const dados: DadosMes = await res.json();
        saldo += calcularSaldoMes(dados);
      }
    } catch { /* mês sem dados — contribui 0 */ }
    cur = mesProximo(cur);
  }

  return saldo;
}
