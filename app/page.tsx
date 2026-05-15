'use client';

import { useEffect, useState } from 'react';
import Nav from '@/components/Nav';
import { Config, DadosMes } from '@/lib/types';
import { formatarValor, formatarMesLongo, mesAtual, mesAnterior, projetarMes, calcularScore, calcularSaldoMes } from '@/lib/financas';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import styles from './dashboard.module.css';

type TipoLanc = 'entrada' | 'debito' | 'credito';

export default function DashboardPage() {
  const [config, setConfig] = useState<Config | null>(null);
  const [dados, setDados] = useState<DadosMes | null>(null);
  const [historico, setHistorico] = useState<DadosMes[]>([]);
  const [saldoAnterior, setSaldoAnterior] = useState(0);
  const [analiseIA, setAnaliseIA] = useState('');
  const [loadingAnalise, setLoadingAnalise] = useState(false);
  const [modalLanc, setModalLanc] = useState(false);
  const [form, setForm] = useState<{ tipo: TipoLanc; descricao: string; valor: string; data: string; categoriaId: string; planejamentoId: string; cartaoId: string; observacao: string }>({
    tipo: 'debito', descricao: '', valor: '', data: new Date().toISOString().slice(0, 10),
    categoriaId: '', planejamentoId: '', cartaoId: '', observacao: '',
  });
  const [salvando, setSalvando] = useState(false);
  const [modalReajuste, setModalReajuste] = useState(false);
  const [reajusteValor, setReajusteValor] = useState('');
  const [reajusteMotivo, setReajusteMotivo] = useState('');
  const [salvandoReajuste, setSalvandoReajuste] = useState(false);

  const mes = mesAtual();

  const carregar = () => {
    fetch(`/api/lancamentos?mes=${mes}`).then(r => r.json()).then(setDados);
  };

  useEffect(() => {
    fetch('/api/config').then(r => r.json()).then(setConfig);
    carregar();
    const meses: string[] = [];
    let cur = mes;
    for (let i = 0; i < 6; i++) { meses.unshift(cur); cur = mesAnterior(cur); }
    Promise.all(meses.map(m => fetch(`/api/lancamentos?mes=${m}`).then(r => r.json())))
      .then(lista => {
        setHistorico(lista);
        // Saldo acumulado de todos os meses ANTERIORES ao atual (os 5 primeiros de 6)
        const anterior = lista.slice(0, -1).reduce((acc: number, d: DadosMes) => acc + calcularSaldoMes(d), 0);
        setSaldoAnterior(anterior);
      });
  }, []);

  if (!config || !dados) return <LoadingSkeleton />;

  const entradas = dados.lancamentos.filter(l => l.tipo === 'entrada').reduce((s, l) => s + l.valor, 0);
  const saidas = dados.lancamentos.filter(l => l.tipo === 'debito').reduce((s, l) => s + l.valor, 0);
  const reajuste = dados.reajuste?.valor ?? 0;
  const saldoMes = entradas - saidas + reajuste;
  const saldoTotal = saldoAnterior + saldoMes;
  const projecao = projetarMes(dados.lancamentos, mes);

  const dadosGrafico = historico.map((d: DadosMes) => {
    const e = d.lancamentos.filter(l => l.tipo === 'entrada').reduce((s, l) => s + l.valor, 0);
    const s = d.lancamentos.filter(l => l.tipo === 'debito').reduce((s, l) => s + l.valor, 0);
    return { mes: d.mes.slice(5), entradas: e, saidas: s };
  });

  const porCategoria = config.categorias
    .filter(c => c.tipo === 'despesa')
    .map(c => ({
      nome: c.nome,
      valor: dados.lancamentos.filter(l => l.categoriaId === c.id && l.tipo === 'debito').reduce((s, l) => s + l.valor, 0),
      cor: c.cor,
    }))
    .filter(c => c.valor > 0)
    .sort((a, b) => b.valor - a.valor);

  const base = config.rendaMensal || entradas;
  const planejamentosData = config.planejamentos.filter(p => p.ativo).map(p => {
    const real = dados.lancamentos.filter(l => l.planejamentoId === p.id && l.tipo === 'debito').reduce((s, l) => s + l.valor, 0);
    const planejado = (p.percentual / 100) * base;
    const pct = planejado > 0 ? Math.min((real / planejado) * 100, 150) : 0;
    return { ...p, real, planejado, pct };
  });

  const score = calcularScore({
    mes, totalEntradas: entradas, totalDebito: saidas, totalCreditoFatura: 0,
    saldoFinal: saldoTotal, saldoInicial: saldoAnterior, reajuste,
    porPlanejamento: planejamentosData.map(p => ({ planejamentoId: p.id, planejado: p.planejado, real: p.real, percentualReal: p.real / (base || 1) * 100 })),
    porCategoria: [],
  });

  const diaHoje = new Date().getDate();
  const diasNoMes = new Date(parseInt(mes.split('-')[0]), parseInt(mes.split('-')[1]), 0).getDate();
  const pctMes = (diaHoje / diasNoMes) * 100;

  const salvarLancamento = async () => {
    if (!form.descricao || !form.valor) return;
    setSalvando(true);
    await fetch('/api/lancamentos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, valor: Number(form.valor) }),
    });
    setSalvando(false);
    setModalLanc(false);
    setForm(f => ({ ...f, descricao: '', valor: '', observacao: '', categoriaId: '', planejamentoId: '', cartaoId: '' }));
    carregar();
  };

  const salvarReajuste = async () => {
    if (!reajusteValor) return;
    setSalvandoReajuste(true);
    await fetch('/api/reajuste', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mes, valor: Number(reajusteValor), motivo: reajusteMotivo }),
    });
    setSalvandoReajuste(false);
    setModalReajuste(false);
    carregar();
  };

  const removerReajuste = async () => {
    if (!confirm('Remover o reajuste deste mês?')) return;
    await fetch('/api/reajuste', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mes }),
    });
    setModalReajuste(false);
    carregar();
  };

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

  const categoriasForm = config.categorias.filter(c => c.tipo === (form.tipo === 'entrada' ? 'entrada' : 'despesa'));

  return (
    <div className={styles.layout}>
      <Nav />
      <main className={styles.main}>
        <div className={styles.header}>
          <div>
            <p className={styles.greeting}>Olá, {config.nomeUsuario} 👋</p>
            <h1 className={styles.titulo}>{formatarMesLongo(mes)}</h1>
          </div>
          <div className={styles.headerAcoes}>
            <button className={styles.btnReajuste} title="Reajuste financeiro" onClick={() => {
              setReajusteValor(dados.reajuste ? String(dados.reajuste.valor) : '');
              setReajusteMotivo(dados.reajuste?.motivo || '');
              setModalReajuste(true);
            }}>⇌</button>
            <div className={styles.scoreBadge} style={{ '--score-color': score >= 80 ? 'var(--green)' : score >= 60 ? 'var(--amber)' : 'var(--red)' } as React.CSSProperties}>
              <span className={styles.scoreNum}>{score}</span>
              <span className={styles.scoreLabel}>score</span>
            </div>
          </div>
        </div>

        <div className={styles.cardsRow}>
          <div className={`${styles.card} ${styles.cardSaldo}`}>
            <p className={styles.cardLabel}>Saldo acumulado</p>
            <p className={`${styles.cardVal} ${saldoTotal >= 0 ? styles.pos : styles.neg}`}>{formatarValor(saldoTotal)}</p>
            <div className={styles.saldoDetalhe}>
              <span className={styles.saldoDetalheItem}>Anterior: <span style={{ color: saldoAnterior >= 0 ? 'var(--green)' : 'var(--red)' }}>{formatarValor(saldoAnterior)}</span></span>
              <span className={styles.saldoDetalheItem}>Este mês: <span style={{ color: saldoMes >= 0 ? 'var(--green)' : 'var(--red)' }}>{formatarValor(saldoMes)}</span></span>
            </div>
            <div className={styles.progressBar}>
              <div className={styles.progressTrack}><div className={styles.progressFill} style={{ width: `${pctMes}%` }} /></div>
              <span className={styles.progressLabel}>dia {diaHoje}/{diasNoMes}</span>
            </div>
            {reajuste !== 0 && (
              <div className={styles.reajusteBadge}>
                ⇌ Reajuste: {reajuste > 0 ? '+' : ''}{formatarValor(reajuste)}{dados.reajuste?.motivo ? ` · ${dados.reajuste.motivo}` : ''}
              </div>
            )}
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

        <button className={styles.btnNovoLanc} onClick={() => setModalLanc(true)}>+ Registrar movimentação</button>

        <div className={styles.chartCard}>
          <h2 className={styles.chartTitle}>Histórico — últimos 6 meses</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={dadosGrafico} barGap={4}>
              <XAxis dataKey="mes" tick={{ fill: 'var(--text3)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip contentStyle={{ background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 8, fontSize: 12 }} formatter={(v: number) => formatarValor(v)} labelStyle={{ color: 'var(--text2)' }} />
              <Bar dataKey="entradas" fill="var(--green)" radius={[4,4,0,0]} opacity={0.8} name="Entradas" />
              <Bar dataKey="saidas" fill="var(--red)" radius={[4,4,0,0]} opacity={0.8} name="Saídas" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className={styles.row2}>
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
          <div className={styles.chartCard}>
            <h2 className={styles.chartTitle}>Planejamentos</h2>
            <div className={styles.planejamentos}>
              {planejamentosData.map(p => (
                <div key={p.id} className={styles.planItem}>
                  <div className={styles.planHeader}>
                    <span className={styles.planNome}>{p.nome}</span>
                    <span className={styles.planPct} style={{ color: p.pct > 100 ? 'var(--red)' : 'var(--text2)' }}>{formatarValor(p.real)} / {formatarValor(p.planejado)}</span>
                  </div>
                  <div className={styles.planBar}><div className={styles.planFill} style={{ width: `${Math.min(p.pct, 100)}%`, background: p.pct > 100 ? 'var(--red)' : p.pct > 80 ? 'var(--amber)' : p.cor }} /></div>
                  <div className={styles.planMeta}>
                    <span style={{ color: 'var(--text3)', fontSize: '0.72rem' }}>{p.percentual}% planejado</span>
                    <span style={{ color: p.pct > 100 ? 'var(--red)' : 'var(--text3)', fontSize: '0.72rem' }}>{p.pct.toFixed(0)}% usado</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

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
          {analiseIA && <div className={styles.iaTexto}>{analiseIA.split('\n').map((l, i) => <p key={i} style={{ marginBottom: l.startsWith('•') ? '0.25rem' : '0.5rem' }}>{l}</p>)}</div>}
          {!analiseIA && !loadingAnalise && <p className={styles.iaPlaceholder}>Clique em "Analisar" para obter um resumo do seu mês com inteligência artificial.</p>}
        </div>

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
            {dados.lancamentos.length === 0 && <p className={styles.vazio}>Nenhum lançamento neste mês ainda.</p>}
          </div>
        </div>
      </main>

      {/* Modal: Registrar movimentação */}
      {modalLanc && (
        <div className="modal-overlay" onClick={() => setModalLanc(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitulo}>Registrar movimentação</h2>
              <button className={styles.modalClose} onClick={() => setModalLanc(false)}>×</button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.tipoRow}>
                {(['entrada', 'debito', 'credito'] as TipoLanc[]).map(t => (
                  <button key={t}
                    className={`${styles.tipoBtn} ${form.tipo === t ? styles.tipoBtnAtivo : ''}`}
                    style={form.tipo === t ? { borderColor: t === 'entrada' ? 'var(--green)' : t === 'debito' ? 'var(--red)' : 'var(--blue)', color: t === 'entrada' ? 'var(--green)' : t === 'debito' ? 'var(--red)' : 'var(--blue)' } : {}}
                    onClick={() => setForm(f => ({ ...f, tipo: t, categoriaId: '', planejamentoId: '', cartaoId: '' }))}
                  >{t === 'entrada' ? '↑ Entrada' : t === 'debito' ? '↓ Débito' : '💳 Crédito'}</button>
                ))}
              </div>
              <div className={styles.formGrid}>
                <div className={styles.formGrupo} style={{ gridColumn: '1/-1' }}>
                  <label className={styles.label}>Descrição *</label>
                  <input className={styles.input} value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Ex: Supermercado" autoFocus />
                </div>
                <div className={styles.formGrupo}>
                  <label className={styles.label}>Valor (R$) *</label>
                  <input className={styles.input} type="number" min="0" step="0.01" value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} placeholder="0,00" />
                </div>
                <div className={styles.formGrupo}>
                  <label className={styles.label}>Data</label>
                  <input className={styles.input} type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} />
                </div>
                <div className={styles.formGrupo}>
                  <label className={styles.label}>Categoria</label>
                  <select className={styles.input} value={form.categoriaId} onChange={e => setForm(f => ({ ...f, categoriaId: e.target.value }))}>
                    <option value="">Sem categoria</option>
                    {categoriasForm.map(c => <option key={c.id} value={c.id}>{c.icone} {c.nome}</option>)}
                  </select>
                </div>
                {form.tipo !== 'entrada' && (
                  <div className={styles.formGrupo}>
                    <label className={styles.label}>Planejamento</label>
                    <select className={styles.input} value={form.planejamentoId} onChange={e => setForm(f => ({ ...f, planejamentoId: e.target.value }))}>
                      <option value="">Sem planejamento</option>
                      {config.planejamentos.filter(p => p.ativo).map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                    </select>
                  </div>
                )}
                {form.tipo === 'credito' && config.cartoes.filter(c => c.ativo).length > 0 && (
                  <div className={styles.formGrupo}>
                    <label className={styles.label}>Cartão</label>
                    <select className={styles.input} value={form.cartaoId} onChange={e => setForm(f => ({ ...f, cartaoId: e.target.value }))}>
                      <option value="">Selecionar</option>
                      {config.cartoes.filter(c => c.ativo).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                    </select>
                  </div>
                )}
                <div className={styles.formGrupo} style={{ gridColumn: '1/-1' }}>
                  <label className={styles.label}>Observação</label>
                  <input className={styles.input} value={form.observacao} onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))} placeholder="Opcional" />
                </div>
              </div>
              <button className={styles.btnSalvar} onClick={salvarLancamento} disabled={salvando || !form.descricao || !form.valor}>
                {salvando ? <span className="loading" style={{ borderTopColor: '#000' }} /> : '✓ Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Reajuste financeiro */}
      {modalReajuste && (
        <div className="modal-overlay" onClick={() => setModalReajuste(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitulo}>⇌ Reajuste financeiro</h2>
              <button className={styles.modalClose} onClick={() => setModalReajuste(false)}>×</button>
            </div>
            <div className={styles.modalBody}>
              <p className={styles.reajusteInfo}>Use para corrigir diferenças de centavos, arredondamentos ou qualquer valor que não fechou corretamente. Positivo adiciona ao saldo, negativo desconta.</p>
              <div className={styles.formGrupo}>
                <label className={styles.label}>Valor do reajuste (R$)</label>
                <input className={styles.input} type="number" step="0.01" value={reajusteValor} onChange={e => setReajusteValor(e.target.value)} placeholder="Ex: -0,50 ou 1,25" autoFocus />
              </div>
              <div className={styles.formGrupo} style={{ marginTop: '0.75rem' }}>
                <label className={styles.label}>Motivo (opcional)</label>
                <input className={styles.input} value={reajusteMotivo} onChange={e => setReajusteMotivo(e.target.value)} placeholder="Ex: Diferença de arredondamento" />
              </div>
              <div className={styles.reajusteAcoes}>
                {dados.reajuste && <button className={styles.btnRemover} onClick={removerReajuste}>Remover</button>}
                <button className={styles.btnSalvar} onClick={salvarReajuste} disabled={salvandoReajuste || !reajusteValor} style={{ flex: 1 }}>
                  {salvandoReajuste ? <span className="loading" style={{ borderTopColor: '#000' }} /> : '✓ Aplicar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
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
