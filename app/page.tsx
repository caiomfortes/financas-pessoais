'use client';

import { useEffect, useState } from 'react';
import Nav from '@/components/Nav';
import { Config, DadosMes } from '@/lib/types';
import { formatarValor, formatarMesLongo, mesAtual, mesAnterior, projetarMes, calcularScore } from '@/lib/financas';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, RadialBarChart, RadialBar
} from 'recharts';
import styles from './dashboard.module.css';

export default function DashboardPage() {
  const [config, setConfig] = useState<Config | null>(null);
  const [dados, setDados] = useState<DadosMes | null>(null);
  const [historico, setHistorico] = useState<DadosMes[]>([]);
  const [analiseIA, setAnaliseIA] = useState('');
  const [loadingAnalise, setLoadingAnalise] = useState(false);
  const mes = mesAtual();

  useEffect(() => {
    fetch('/api/config').then(r => r.json()).then(setConfig);
    fetch(`/api/lancamentos?mes=${mes}`).then(r => r.json()).then(setDados);

    // Busca últimos 6 meses para gráfico
    const meses: string[] = [];
    let cur = mes;
    for (let i = 0; i < 6; i++) {
      meses.unshift(cur);
      cur = mesAnterior(cur);
    }
    Promise.all(meses.map(m => fetch(`/api/lancamentos?mes=${m}`).then(r => r.json())))
      .then(setHistorico);
  }, []);

  if (!config || !dados) return <LoadingSkeleton />;

  const entradas = dados.lancamentos.filter(l => l.tipo === 'entrada').reduce((s, l) => s + l.valor, 0);
  const saidas = dados.lancamentos.filter(l => l.tipo === 'debito').reduce((s, l) => s + l.valor, 0);
  const saldo = entradas - saidas;
  const projecao = projetarMes(dados.lancamentos, mes);

  // Dados para gráfico histórico
  const dadosGrafico = historico.map(d => {
    const e = d.lancamentos.filter(l => l.tipo === 'entrada').reduce((s, l) => s + l.valor, 0);
    const s = d.lancamentos.filter(l => l.tipo === 'debito').reduce((s, l) => s + l.valor, 0);
    return { mes: d.mes.slice(5), entradas: e, saidas: s, saldo: e - s };
  });

  // Pizza por categoria
  const porCategoria = config.categorias
    .filter(c => c.tipo === 'despesa')
    .map(c => ({
      nome: c.nome,
      valor: dados.lancamentos.filter(l => l.categoriaId === c.id && l.tipo === 'debito').reduce((s, l) => s + l.valor, 0),
      cor: c.cor,
    }))
    .filter(c => c.valor > 0)
    .sort((a, b) => b.valor - a.valor);

  // Planejamentos
  const base = config.rendaMensal || entradas;
  const planejamentosData = config.planejamentos.filter(p => p.ativo).map(p => {
    const real = dados.lancamentos.filter(l => l.planejamentoId === p.id && l.tipo === 'debito').reduce((s, l) => s + l.valor, 0);
    const planejado = (p.percentual / 100) * base;
    const pct = planejado > 0 ? Math.min((real / planejado) * 100, 150) : 0;
    return { ...p, real, planejado, pct };
  });

  const score = calcularScore({ mes, totalEntradas: entradas, totalDebito: saidas, totalCreditoFatura: 0, saldoFinal: saldo, saldoInicial: 0, reajuste: 0, porPlanejamento: planejamentosData.map(p => ({ planejamentoId: p.id, planejado: p.planejado, real: p.real, percentualReal: p.real / (base || 1) * 100 })), porCategoria: [] });

  const buscarAnalise = async () => {
    setLoadingAnalise(true);
    const r = await fetch('/api/ia', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modo: 'analise', mes }),
    });
    const d = await r.json();
    setAnaliseIA(d.analise || '');
    setLoadingAnalise(false);
  };

  const diaHoje = new Date().getDate();
  const diasNoMes = new Date(parseInt(mes.split('-')[0]), parseInt(mes.split('-')[1]), 0).getDate();
  const pctMes = (diaHoje / diasNoMes) * 100;

  return (
    <div className={styles.layout}>
      <Nav />
      <main className={styles.main}>
        {/* Header */}
        <div className={styles.header}>
          <div>
            <p className={styles.greeting}>Olá, {config.nomeUsuario} 👋</p>
            <h1 className={styles.titulo}>{formatarMesLongo(mes)}</h1>
          </div>
          <div className={styles.scoreBadge} style={{ '--score-color': score >= 80 ? 'var(--green)' : score >= 60 ? 'var(--amber)' : 'var(--red)' } as React.CSSProperties}>
            <span className={styles.scoreNum}>{score}</span>
            <span className={styles.scoreLabel}>score</span>
          </div>
        </div>

        {/* Cards principais */}
        <div className={styles.cardsRow}>
          <div className={`${styles.card} ${styles.cardSaldo}`}>
            <p className={styles.cardLabel}>Saldo do mês</p>
            <p className={`${styles.cardVal} ${saldo >= 0 ? styles.pos : styles.neg}`}>
              {formatarValor(saldo)}
            </p>
            <div className={styles.progressBar}>
              <div className={styles.progressTrack}>
                <div className={styles.progressFill} style={{ width: `${pctMes}%` }} />
              </div>
              <span className={styles.progressLabel}>dia {diaHoje}/{diasNoMes}</span>
            </div>
          </div>

          <div className={styles.card}>
            <p className={styles.cardLabel}>Entradas</p>
            <p className={`${styles.cardVal} ${styles.pos}`}>{formatarValor(entradas)}</p>
            <p className={styles.cardSub}>↑ {dados.lancamentos.filter(l => l.tipo === 'entrada').length} lançamentos</p>
          </div>

          <div className={styles.card}>
            <p className={styles.cardLabel}>Saídas</p>
            <p className={`${styles.cardVal} ${styles.neg}`}>{formatarValor(saidas)}</p>
            <p className={styles.cardSub}>↓ {dados.lancamentos.filter(l => l.tipo === 'debito').length} lançamentos</p>
          </div>

          <div className={`${styles.card} ${styles.cardProjecao}`}>
            <p className={styles.cardLabel}>Projeção do mês</p>
            <p className={styles.cardVal}>{formatarValor(projecao)}</p>
            <p className={styles.cardSub}>no ritmo atual</p>
          </div>
        </div>

        {/* Gráfico histórico */}
        <div className={styles.chartCard}>
          <h2 className={styles.chartTitle}>Histórico — últimos 6 meses</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={dadosGrafico} barGap={4}>
              <XAxis dataKey="mes" tick={{ fill: 'var(--text3)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip
                contentStyle={{ background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 8, fontSize: 12 }}
                formatter={(v: number) => formatarValor(v)}
                labelStyle={{ color: 'var(--text2)' }}
              />
              <Bar dataKey="entradas" fill="var(--green)" radius={[4,4,0,0]} opacity={0.8} name="Entradas" />
              <Bar dataKey="saidas" fill="var(--red)" radius={[4,4,0,0]} opacity={0.8} name="Saídas" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className={styles.row2}>
          {/* Pizza categorias */}
          {porCategoria.length > 0 && (
            <div className={styles.chartCard}>
              <h2 className={styles.chartTitle}>Gastos por categoria</h2>
              <div className={styles.pizzaWrap}>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={porCategoria} dataKey="valor" nameKey="nome" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3}>
                      {porCategoria.map((c, i) => <Cell key={i} fill={c.cor} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 8, fontSize: 12 }} formatter={(v: number) => formatarValor(v)} />
                  </PieChart>
                </ResponsiveContainer>
                <div className={styles.legendas}>
                  {porCategoria.slice(0, 5).map((c, i) => (
                    <div key={i} className={styles.legenda}>
                      <span className={styles.legendaDot} style={{ background: c.cor }} />
                      <span>{c.nome}</span>
                      <span className={styles.legendaVal}>{formatarValor(c.valor)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Planejamentos */}
          <div className={styles.chartCard}>
            <h2 className={styles.chartTitle}>Planejamentos</h2>
            <div className={styles.planejamentos}>
              {planejamentosData.map(p => (
                <div key={p.id} className={styles.planItem}>
                  <div className={styles.planHeader}>
                    <span className={styles.planNome}>{p.nome}</span>
                    <span className={styles.planPct} style={{ color: p.pct > 100 ? 'var(--red)' : 'var(--text2)' }}>
                      {formatarValor(p.real)} / {formatarValor(p.planejado)}
                    </span>
                  </div>
                  <div className={styles.planBar}>
                    <div
                      className={styles.planFill}
                      style={{
                        width: `${Math.min(p.pct, 100)}%`,
                        background: p.pct > 100 ? 'var(--red)' : p.pct > 80 ? 'var(--amber)' : p.cor,
                      }}
                    />
                  </div>
                  <div className={styles.planMeta}>
                    <span style={{ color: 'var(--text3)', fontSize: '0.72rem' }}>{p.percentual}% planejado</span>
                    <span style={{ color: p.pct > 100 ? 'var(--red)' : 'var(--text3)', fontSize: '0.72rem' }}>
                      {p.pct.toFixed(0)}% usado
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Análise IA */}
        <div className={styles.iaCard}>
          <div className={styles.iaHeader}>
            <div>
              <h2 className={styles.chartTitle}>Análise com IA</h2>
              <p className={styles.iaSub}>Resumo inteligente do seu mês</p>
            </div>
            <button className={styles.iaBtn} onClick={buscarAnalise} disabled={loadingAnalise}>
              {loadingAnalise ? <span className="loading" style={{ borderTopColor: '#000' }} /> : '✦ Analisar'}
            </button>
          </div>
          {analiseIA && (
            <div className={styles.iaTexto}>
              {analiseIA.split('\n').map((linha, i) => (
                <p key={i} style={{ marginBottom: linha.startsWith('•') ? '0.25rem' : '0.5rem' }}>{linha}</p>
              ))}
            </div>
          )}
          {!analiseIA && !loadingAnalise && (
            <p className={styles.iaPlaceholder}>Clique em "Analisar" para obter um resumo do seu mês com inteligência artificial.</p>
          )}
        </div>

        {/* Últimos lançamentos */}
        <div className={styles.chartCard}>
          <div className={styles.lancHeader}>
            <h2 className={styles.chartTitle}>Últimos lançamentos</h2>
            <a href="/lancamentos" className={styles.verTodos}>Ver todos →</a>
          </div>
          <div className={styles.lancList}>
            {dados.lancamentos.slice(-5).reverse().map(l => {
              const cat = config.categorias.find(c => c.id === l.categoriaId);
              return (
                <div key={l.id} className={styles.lancItem}>
                  <span className={styles.lancIcon}>{cat?.icone || '·'}</span>
                  <div className={styles.lancInfo}>
                    <span className={styles.lancDesc}>{l.descricao}</span>
                    <span className={styles.lancMeta}>{l.data} · {cat?.nome}</span>
                  </div>
                  <span className={`${styles.lancVal} ${l.tipo === 'entrada' ? styles.pos : styles.neg}`}>
                    {l.tipo === 'entrada' ? '+' : '-'}{formatarValor(l.valor)}
                  </span>
                </div>
              );
            })}
            {dados.lancamentos.length === 0 && (
              <p className={styles.vazio}>Nenhum lançamento neste mês ainda.</p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className={styles.layout}>
      <Nav />
      <main className={styles.main}>
        <div className={styles.header}>
          <div>
            <div className="skeleton" style={{ width: 120, height: 16, marginBottom: 8 }} />
            <div className="skeleton" style={{ width: 200, height: 28 }} />
          </div>
        </div>
        <div className={styles.cardsRow}>
          {[1,2,3,4].map(i => <div key={i} className={`${styles.card} skeleton`} style={{ height: 100 }} />)}
        </div>
      </main>
    </div>
  );
}
