'use client';

import { useEffect, useState } from 'react';
import Nav from '@/components/Nav';
import { Config, DadosMes } from '@/lib/types';
import { formatarValor, mesAtual, formatarMesLongo, mesAnterior, mesProximo, calcularScore, projetarMes } from '@/lib/financas';
import { RadialBarChart, RadialBar, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, Legend } from 'recharts';
import styles from './planejamento.module.css';

export default function PlanejamentoPage() {
  const [config, setConfig] = useState<Config | null>(null);
  const [dados, setDados] = useState<DadosMes | null>(null);
  const [historico, setHistorico] = useState<DadosMes[]>([]);
  const [mes, setMes] = useState(mesAtual());

  useEffect(() => { fetch('/api/config').then(r => r.json()).then(setConfig); }, []);
  useEffect(() => {
    fetch(`/api/lancamentos?mes=${mes}`).then(r => r.json()).then(setDados);
    const meses: string[] = []; let cur = mes;
    for (let i = 0; i < 6; i++) { meses.unshift(cur); cur = mesAnterior(cur); }
    Promise.all(meses.map(m => fetch(`/api/lancamentos?mes=${m}`).then(r => r.json()))).then(setHistorico);
  }, [mes]);

  if (!config || !dados) return null;

  const entradas = dados.lancamentos.filter(l => l.tipo === 'entrada').reduce((s, l) => s + l.valor, 0);
  const base = config.rendaMensal || entradas;

  const planejamentosData = config.planejamentos.filter(p => p.ativo).map(p => {
    const real = dados.lancamentos.filter(l => l.planejamentoId === p.id && l.tipo === 'debito').reduce((s, l) => s + l.valor, 0);
    const planejado = (p.percentual / 100) * base;
    const pct = planejado > 0 ? (real / planejado) * 100 : 0;
    return { ...p, real, planejado, pct };
  });

  const score = calcularScore({
    mes, totalEntradas: entradas,
    totalDebito: dados.lancamentos.filter(l => l.tipo === 'debito').reduce((s, l) => s + l.valor, 0),
    totalCreditoFatura: 0, saldoFinal: 0, saldoInicial: 0, reajuste: 0,
    porPlanejamento: planejamentosData.map(p => ({ planejamentoId: p.id, planejado: p.planejado, real: p.real, percentualReal: p.pct })),
    porCategoria: [],
  });

  // Dados históricos para gráfico de linha
  const dadosHistorico = historico.map(d => {
    const e = d.lancamentos.filter(l => l.tipo === 'entrada').reduce((s, l) => s + l.valor, 0);
    const b = config.rendaMensal || e;
    const obj: Record<string, number | string> = { mes: d.mes.slice(5) };
    config.planejamentos.filter(p => p.ativo).forEach(p => {
      const real = d.lancamentos.filter(l => l.planejamentoId === p.id && l.tipo === 'debito').reduce((s, l) => s + l.valor, 0);
      obj[p.nome] = b > 0 ? Math.round((real / b) * 100) : 0;
    });
    return obj;
  });

  // Treemap data
  const treemapData = config.categorias.filter(c => c.tipo === 'despesa').map(c => ({
    nome: c.nome, icone: c.icone, cor: c.cor,
    valor: dados.lancamentos.filter(l => l.categoriaId === c.id && l.tipo === 'debito').reduce((s, l) => s + l.valor, 0),
  })).filter(c => c.valor > 0).sort((a, b) => b.valor - a.valor);

  const totalGastos = treemapData.reduce((s, c) => s + c.valor, 0);

  const CORES_PLANEJAMENTO = ['#00d68f', '#4d9eff', '#ffb347', '#a78bfa', '#ff4d6d', '#34d399'];

  return (
    <div className={styles.layout}>
      <Nav />
      <main className={styles.main}>
        <div className={styles.header}>
          <div className={styles.mesNav}>
            <button onClick={() => setMes(mesAnterior(mes))}>‹</button>
            <h1 className={styles.titulo}>{formatarMesLongo(mes)}</h1>
            <button onClick={() => setMes(mesProximo(mes))}>›</button>
          </div>
        </div>

        {/* Score */}
        <div className={styles.scoreCard}>
          <div className={styles.scoreInfo}>
            <h2 className={styles.scoreLabel}>Score de planejamento</h2>
            <div className={styles.scoreNum} style={{ color: score >= 80 ? 'var(--green)' : score >= 60 ? 'var(--amber)' : 'var(--red)' }}>
              {score}
              <span className={styles.scoreDe}>/100</span>
            </div>
            <p className={styles.scoreSub}>
              {score >= 80 ? '🎉 Parabéns! Você seguiu bem o planejamento.' : score >= 60 ? '⚠️ Atenção a alguns planejamentos.' : '❌ Vários planejamentos foram ultrapassados.'}
            </p>
          </div>
          <ResponsiveContainer width={120} height={120}>
            <RadialBarChart innerRadius={35} outerRadius={55} data={[{ value: score, fill: score >= 80 ? 'var(--green)' : score >= 60 ? 'var(--amber)' : 'var(--red)' }]} startAngle={90} endAngle={-270}>
              <RadialBar dataKey="value" cornerRadius={8} background={{ fill: 'var(--bg3)' }} />
            </RadialBarChart>
          </ResponsiveContainer>
        </div>

        {/* Planejamentos detalhados */}
        <div className={styles.chartCard}>
          <h2 className={styles.chartTitle}>Planejamentos vs real</h2>
          {planejamentosData.map((p, i) => (
            <div key={p.id} className={styles.planItem}>
              <div className={styles.planHeader}>
                <div className={styles.planNome} style={{ color: p.cor }}>● {p.nome}</div>
                <div className={styles.planVals}>
                  <span className={styles.planReal} style={{ color: p.pct > 100 ? 'var(--red)' : 'var(--text)' }}>{formatarValor(p.real)}</span>
                  <span className={styles.planSep}>/</span>
                  <span className={styles.planPlanejado}>{formatarValor(p.planejado)}</span>
                  <span className={`${styles.planBadge} ${p.pct > 100 ? styles.planBadgeRed : p.pct > 80 ? styles.planBadgeAmber : styles.planBadgeGreen}`}>
                    {p.pct.toFixed(0)}%
                  </span>
                </div>
              </div>
              <div className={styles.planBarContainer}>
                <div className={styles.planBarTrack}>
                  <div className={styles.planBarFill} style={{
                    width: `${Math.min(p.pct, 100)}%`,
                    background: p.pct > 100 ? 'var(--red)' : p.pct > 80 ? 'var(--amber)' : p.cor,
                  }} />
                </div>
                <span className={styles.planPct}>{p.percentual}% do orçamento</span>
              </div>
            </div>
          ))}
        </div>

        {/* Evolução histórica */}
        <div className={styles.chartCard}>
          <h2 className={styles.chartTitle}>Evolução dos planejamentos (% usado)</h2>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={dadosHistorico}>
              <XAxis dataKey="mes" tick={{ fill: 'var(--text3)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--text3)', fontSize: 11 }} axisLine={false} tickLine={false} unit="%" />
              <Tooltip contentStyle={{ background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 8, fontSize: 12 }} formatter={(v: number) => `${v}%`} />
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
              {config.planejamentos.filter(p => p.ativo).map((p, i) => (
                <Line key={p.id} type="monotone" dataKey={p.nome} stroke={p.cor} strokeWidth={2} dot={{ fill: p.cor, r: 3 }} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Distribuição por categoria (treemap visual) */}
        {treemapData.length > 0 && (
          <div className={styles.chartCard}>
            <h2 className={styles.chartTitle}>Distribuição de gastos</h2>
            <div className={styles.treemap}>
              {treemapData.map((c, i) => {
                const pct = (c.valor / totalGastos) * 100;
                return (
                  <div key={i} className={styles.treemapItem} style={{ flex: pct, background: `${c.cor}22`, border: `1px solid ${c.cor}44`, minWidth: pct < 10 ? '60px' : undefined }}>
                    <div className={styles.treemapIcon}>{c.icone}</div>
                    <div className={styles.treemapNome}>{c.nome}</div>
                    <div className={styles.treemapVal}>{formatarValor(c.valor)}</div>
                    <div className={styles.treemapPct}>{pct.toFixed(0)}%</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
