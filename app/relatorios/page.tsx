'use client';

import { useEffect, useState } from 'react';
import Nav from '@/components/Nav';
import { Config, DadosMes } from '@/lib/types';
import { formatarValor, mesAtual, mesAnterior, formatarMes, projetarMes, mesProximo } from '@/lib/financas';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';
import styles from './relatorios.module.css';

export default function RelatoriosPage() {
  const [config, setConfig] = useState<Config | null>(null);
  const [historico, setHistorico] = useState<DadosMes[]>([]);
  const [mesAtualDados, setMesAtualDados] = useState<DadosMes | null>(null);

  useEffect(() => {
    fetch('/api/config').then(r => r.json()).then(setConfig);
    const mes = mesAtual();
    fetch(`/api/lancamentos?mes=${mes}`).then(r => r.json()).then(setMesAtualDados);

    const meses: string[] = []; let cur = mes;
    for (let i = 0; i < 6; i++) { meses.unshift(cur); cur = mesAnterior(cur); }
    Promise.all(meses.map(m => fetch(`/api/lancamentos?mes=${m}`).then(r => r.json()))).then(setHistorico);
  }, []);

  if (!config || !historico.length || !mesAtualDados) return null;

  // Dados históricos
  const dadosGrafico = historico.map(d => {
    const e = d.lancamentos.filter(l => l.tipo === 'entrada').reduce((s, l) => s + l.valor, 0);
    const s = d.lancamentos.filter(l => l.tipo === 'debito').reduce((s, l) => s + l.valor, 0);
    return { mes: formatarMes(d.mes), entradas: e, saidas: s, saldo: e - s };
  });

  // Média dos últimos 3 meses
  const ultimos3 = historico.slice(-3);
  const mediaEntradas = ultimos3.reduce((s, d) => s + d.lancamentos.filter(l => l.tipo === 'entrada').reduce((ss, l) => ss + l.valor, 0), 0) / 3;
  const mediaSaidas = ultimos3.reduce((s, d) => s + d.lancamentos.filter(l => l.tipo === 'debito').reduce((ss, l) => ss + l.valor, 0), 0) / 3;
  const mediaSaldo = mediaEntradas - mediaSaidas;

  // Projeção 3 meses futuros
  const mes = mesAtual();
  const projecao3meses = [1, 2, 3].map(i => {
    const m = (() => { let cur = mes; for (let j = 0; j < i; j++) cur = mesProximo(cur); return cur; })();
    return { mes: formatarMes(m), entradas: mediaEntradas, saidas: mediaSaidas, saldo: mediaSaldo, projetado: true };
  });

  const dadosComProjecao = [...dadosGrafico, ...projecao3meses];

  // Quanto tempo para poupar X
  const poupancaMensal = mediaSaldo;
  const metas = [1000, 5000, 10000, 50000].map(meta => ({
    meta,
    meses: poupancaMensal > 0 ? Math.ceil(meta / poupancaMensal) : null,
  }));

  // Projeção do mês atual
  const projecaoMesAtual = projetarMes(mesAtualDados.lancamentos, mes);
  const gastosAte = mesAtualDados.lancamentos.filter(l => l.tipo === 'debito').reduce((s, l) => s + l.valor, 0);

  // Heatmap de gastos por dia do mês
  const hoje = new Date();
  const diasNoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
  const gastosPorDia = Array.from({ length: diasNoMes }, (_, i) => {
    const dia = String(i + 1).padStart(2, '0');
    const prefixo = mes + '-' + dia;
    const total = mesAtualDados.lancamentos
      .filter(l => l.data === prefixo && l.tipo === 'debito')
      .reduce((s, l) => s + l.valor, 0);
    return { dia: i + 1, valor: total };
  });
  const maxDia = Math.max(...gastosPorDia.map(d => d.valor));

  return (
    <div className={styles.layout}>
      <Nav />
      <main className={styles.main}>
        <h1 className={styles.titulo}>Relatórios</h1>

        {/* Projeção do mês */}
        <div className={styles.projecaoCard}>
          <div className={styles.projecaoInfo}>
            <p className={styles.projecaoLabel}>Projeção de gastos — mês atual</p>
            <p className={styles.projecaoVal}>{formatarValor(projecaoMesAtual)}</p>
            <p className={styles.projecaoSub}>
              {gastosAte > 0 ? `${formatarValor(gastosAte)} gastos até hoje` : 'Sem gastos registrados ainda'}
            </p>
          </div>
          {projecaoMesAtual > mediaSaidas && (
            <div className={styles.projecaoAlerta}>⚠ Acima da sua média ({formatarValor(mediaSaidas)})</div>
          )}
        </div>

        {/* Histórico + projeção futura */}
        <div className={styles.chartCard}>
          <h2 className={styles.chartTitle}>Histórico e projeção — 9 meses</h2>
          <p className={styles.chartSub}>Barras tracejadas = projetado com base na média</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={dadosComProjecao} barGap={4}>
              <XAxis dataKey="mes" tick={{ fill: 'var(--text3)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip contentStyle={{ background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 8, fontSize: 12 }} formatter={(v: number) => formatarValor(v)} />
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <Bar dataKey="entradas" name="Entradas" fill="var(--green)" radius={[4,4,0,0]} opacity={0.85}
                shape={(props: any) => {
                  const { x, y, width, height, payload } = props;
                  return <rect x={x} y={y} width={width} height={height} fill="var(--green)" rx={4} opacity={payload.projetado ? 0.4 : 0.85} strokeDasharray={payload.projetado ? "4 2" : undefined} stroke={payload.projetado ? "var(--green)" : undefined} strokeWidth={payload.projetado ? 1 : 0} />;
                }}
              />
              <Bar dataKey="saidas" name="Saídas" fill="var(--red)" radius={[4,4,0,0]} opacity={0.85}
                shape={(props: any) => {
                  const { x, y, width, height, payload } = props;
                  return <rect x={x} y={y} width={width} height={height} fill="var(--red)" rx={4} opacity={payload.projetado ? 0.4 : 0.85} strokeDasharray={payload.projetado ? "4 2" : undefined} stroke={payload.projetado ? "var(--red)" : undefined} strokeWidth={payload.projetado ? 1 : 0} />;
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Saldo ao longo do tempo */}
        <div className={styles.chartCard}>
          <h2 className={styles.chartTitle}>Evolução do saldo</h2>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={dadosComProjecao}>
              <defs>
                <linearGradient id="gradSaldo" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--green)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--green)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="mes" tick={{ fill: 'var(--text3)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip contentStyle={{ background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 8, fontSize: 12 }} formatter={(v: number) => formatarValor(v)} />
              <ReferenceLine y={0} stroke="var(--border2)" strokeDasharray="3 3" />
              <Area type="monotone" dataKey="saldo" name="Saldo" stroke="var(--green)" strokeWidth={2} fill="url(#gradSaldo)" dot={{ fill: 'var(--green)', r: 3 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Médias */}
        <div className={styles.mediasGrid}>
          <div className={styles.mediaCard}>
            <p className={styles.mediaLabel}>Média de entradas</p>
            <p className={`${styles.mediaVal} ${styles.pos}`}>{formatarValor(mediaEntradas)}</p>
            <p className={styles.mediaSub}>últimos 3 meses</p>
          </div>
          <div className={styles.mediaCard}>
            <p className={styles.mediaLabel}>Média de saídas</p>
            <p className={`${styles.mediaVal} ${styles.neg}`}>{formatarValor(mediaSaidas)}</p>
            <p className={styles.mediaSub}>últimos 3 meses</p>
          </div>
          <div className={styles.mediaCard}>
            <p className={styles.mediaLabel}>Poupança média</p>
            <p className={`${styles.mediaVal} ${mediaSaldo >= 0 ? styles.pos : styles.neg}`}>{formatarValor(mediaSaldo)}</p>
            <p className={styles.mediaSub}>por mês</p>
          </div>
        </div>

        {/* Metas de poupança */}
        {poupancaMensal > 0 && (
          <div className={styles.chartCard}>
            <h2 className={styles.chartTitle}>⏱ Com o ritmo atual, você consegue poupar</h2>
            <div className={styles.metasGrid}>
              {metas.map(m => (
                <div key={m.meta} className={styles.metaCard}>
                  <p className={styles.metaVal}>{formatarValor(m.meta)}</p>
                  <p className={styles.metaMeses}>
                    {m.meses ? `em ~${m.meses} ${m.meses === 1 ? 'mês' : 'meses'}` : 'saldo negativo'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Heatmap de gastos */}
        <div className={styles.chartCard}>
          <h2 className={styles.chartTitle}>Gastos por dia — mês atual</h2>
          <div className={styles.heatmap}>
            {gastosPorDia.map(d => {
              const intensidade = maxDia > 0 ? d.valor / maxDia : 0;
              return (
                <div
                  key={d.dia}
                  className={styles.heatmapCell}
                  style={{ background: intensidade > 0 ? `rgba(255,77,109,${0.1 + intensidade * 0.7})` : 'var(--surface2)' }}
                  title={`Dia ${d.dia}: ${formatarValor(d.valor)}`}
                >
                  <span className={styles.heatmapDia}>{d.dia}</span>
                  {d.valor > 0 && <span className={styles.heatmapVal}>{formatarValor(d.valor)}</span>}
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
