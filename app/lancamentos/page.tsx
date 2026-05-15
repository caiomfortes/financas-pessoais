'use client';

import { useEffect, useState, useRef } from 'react';
import Nav from '@/components/Nav';
import { Config, DadosMes, Lancamento, LancamentoSugerido } from '@/lib/types';
import { formatarValor, mesAtual, formatarMesLongo, mesAnterior, mesProximo, uid } from '@/lib/financas';
import styles from './lancamentos.module.css';

type Modo = 'lista' | 'novo' | 'ia-texto' | 'ia-foto' | 'chat';

export default function LancamentosPage() {
  const [config, setConfig] = useState<Config | null>(null);
  const [dados, setDados] = useState<DadosMes | null>(null);
  const [mes, setMes] = useState(mesAtual());
  const [modo, setModo] = useState<Modo>('lista');
  const [filtro, setFiltro] = useState<'todos' | 'entrada' | 'debito' | 'credito'>('todos');
  const [sugestao, setSugestao] = useState<LancamentoSugerido | null>(null);
  const [form, setForm] = useState(formVazio());
  const [salvando, setSalvando] = useState(false);
  const [iaTexto, setIaTexto] = useState('');
  const [iaLoading, setIaLoading] = useState(false);
  const [chat, setChat] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const chatRef = useRef<HTMLDivElement>(null);
  const fotoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/config').then(r => r.json()).then(setConfig);
  }, []);

  useEffect(() => {
    fetch(`/api/lancamentos?mes=${mes}`).then(r => r.json()).then(setDados);
  }, [mes]);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [chat]);

  function formVazio() {
    return { tipo: 'debito' as const, descricao: '', valor: '', data: new Date().toISOString().slice(0, 10), categoriaId: '', planejamentoId: '', cartaoId: '', observacao: '' };
  }

  const lancamentosFiltrados = (dados?.lancamentos || [])
    .filter(l => filtro === 'todos' || l.tipo === filtro)
    .sort((a, b) => b.data.localeCompare(a.data));

  const totalEntradas = (dados?.lancamentos || []).filter(l => l.tipo === 'entrada').reduce((s, l) => s + l.valor, 0);
  const totalSaidas = (dados?.lancamentos || []).filter(l => l.tipo === 'debito').reduce((s, l) => s + l.valor, 0);

  const salvar = async (dados: typeof form) => {
    if (!dados.descricao || !dados.valor) return;
    setSalvando(true);
    await fetch('/api/lancamentos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...dados, valor: Number(dados.valor) }),
    });
    setSalvando(false);
    setForm(formVazio());
    setSugestao(null);
    setModo('lista');
    fetch(`/api/lancamentos?mes=${mes}`).then(r => r.json()).then(setDados);
  };

  const deletar = async (l: Lancamento) => {
    if (!confirm('Excluir este lançamento?')) return;
    await fetch('/api/lancamentos', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: l.id, mes }),
    });
    fetch(`/api/lancamentos?mes=${mes}`).then(r => r.json()).then(setDados);
  };

  const processarTextoIA = async () => {
    if (!iaTexto.trim()) return;
    setIaLoading(true);
    const r = await fetch('/api/ia', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modo: 'texto', texto: iaTexto }),
    });
    const d = await r.json();
    if (!d.error) {
      setSugestao(d);
      setForm(f => ({
        ...f,
        tipo: d.tipo || f.tipo,
        descricao: d.descricao || f.descricao,
        valor: d.valor?.toString() || f.valor,
        data: d.data || f.data,
        categoriaId: d.categoriaId || f.categoriaId,
        planejamentoId: d.planejamentoId || f.planejamentoId,
        cartaoId: d.cartaoId || f.cartaoId,
        observacao: d.observacao || f.observacao,
      }));
      setModo('novo');
    }
    setIaLoading(false);
    setIaTexto('');
  };

  const processarFoto = async (file: File) => {
    setIaLoading(true);
    const reader = new FileReader();
    reader.onload = async e => {
      const base64 = (e.target?.result as string).split(',')[1];
      const r = await fetch('/api/ia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modo: 'foto', imagemBase64: base64, mimeType: file.type }),
      });
      const d = await r.json();
      if (!d.error) {
        setSugestao(d);
        setForm(f => ({ ...f, tipo: 'debito', descricao: d.descricao || '', valor: d.valor?.toString() || '', data: d.data || f.data, categoriaId: d.categoriaId || '', observacao: d.observacao || '' }));
        setModo('novo');
      }
      setIaLoading(false);
    };
    reader.readAsDataURL(file);
  };

  const enviarChat = async () => {
    if (!chatInput.trim()) return;
    const msg = chatInput.trim();
    setChatInput('');
    const novo = [...chat, { role: 'user' as const, content: msg }];
    setChat(novo);
    const r = await fetch('/api/ia', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modo: 'chat', mensagem: msg, mes, historico: chat }),
    });
    const d = await r.json();
    setChat([...novo, { role: 'assistant', content: d.resposta || 'Desculpe, não consegui responder.' }]);
  };

  if (!config) return null;
  const categoriasFiltradas = config.categorias.filter(c => c.tipo === (form.tipo === 'entrada' ? 'entrada' : 'despesa'));

  return (
    <div className={styles.layout}>
      <Nav />
      <main className={styles.main}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.mesNav}>
            <button onClick={() => setMes(mesAnterior(mes))}>‹</button>
            <h1 className={styles.titulo}>{formatarMesLongo(mes)}</h1>
            <button onClick={() => setMes(mesProximo(mes))}>›</button>
          </div>
          <div className={styles.headerAcoes}>
            <button className={styles.btnIA} onClick={() => setModo('chat')} title="Chat IA">✦</button>
            <button className={styles.btnNovo} onClick={() => setModo('novo')}>+ Novo</button>
          </div>
        </div>

        {/* Resumo rápido */}
        <div className={styles.resumo}>
          <div className={styles.resumoItem}>
            <span className={styles.resumoLabel}>Entradas</span>
            <span className={`${styles.resumoVal} ${styles.pos}`}>{formatarValor(totalEntradas)}</span>
          </div>
          <div className={styles.resumoDivider} />
          <div className={styles.resumoItem}>
            <span className={styles.resumoLabel}>Saídas</span>
            <span className={`${styles.resumoVal} ${styles.neg}`}>{formatarValor(totalSaidas)}</span>
          </div>
          <div className={styles.resumoDivider} />
          <div className={styles.resumoItem}>
            <span className={styles.resumoLabel}>Saldo</span>
            <span className={`${styles.resumoVal} ${totalEntradas - totalSaidas >= 0 ? styles.pos : styles.neg}`}>
              {formatarValor(totalEntradas - totalSaidas)}
            </span>
          </div>
        </div>

        {/* Filtros */}
        <div className={styles.filtros}>
          {(['todos', 'entrada', 'debito', 'credito'] as const).map(f => (
            <button key={f} className={`${styles.filtroBtn} ${filtro === f ? styles.filtroBtnAtivo : ''}`} onClick={() => setFiltro(f)}>
              {f === 'todos' ? 'Todos' : f === 'entrada' ? 'Entradas' : f === 'debito' ? 'Débito' : 'Crédito'}
            </button>
          ))}
        </div>

        {/* Lista */}
        <div className={styles.lista}>
          {lancamentosFiltrados.length === 0 && (
            <div className={styles.vazio}>
              <p>Nenhum lançamento</p>
              <p style={{ fontSize: '0.78rem', marginTop: '0.25rem' }}>Use "+ Novo" ou "✦ IA" para adicionar</p>
            </div>
          )}
          {lancamentosFiltrados.map(l => {
            const cat = config.categorias.find(c => c.id === l.categoriaId);
            const plan = config.planejamentos.find(p => p.id === l.planejamentoId);
            const cartao = config.cartoes.find(c => c.id === l.cartaoId);
            return (
              <div key={l.id} className={styles.item}>
                <div className={styles.itemIcon} style={{ background: `${cat?.cor}22` }}>
                  <span>{cat?.icone || (l.tipo === 'entrada' ? '↑' : '↓')}</span>
                </div>
                <div className={styles.itemInfo}>
                  <span className={styles.itemDesc}>{l.descricao}</span>
                  <div className={styles.itemMeta}>
                    <span>{l.data}</span>
                    {cat && <span className={styles.tag} style={{ color: cat.cor }}>{cat.nome}</span>}
                    {plan && <span className={styles.tag}>{plan.nome}</span>}
                    {cartao && <span className={styles.tag}>💳 {cartao.nome}</span>}
                  </div>
                </div>
                <div className={styles.itemDireita}>
                  <span className={`${styles.itemVal} ${l.tipo === 'entrada' ? styles.pos : styles.neg}`}>
                    {l.tipo === 'entrada' ? '+' : '-'}{formatarValor(l.valor)}
                  </span>
                  <button className={styles.itemDel} onClick={() => deletar(l)}>×</button>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Modal novo lançamento */}
      {modo === 'novo' && (
        <div className="modal-overlay" onClick={() => { setModo('lista'); setSugestao(null); }}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitulo}>Novo lançamento</h2>
              <div className={styles.iaOpcoes}>
                <button className={styles.iaOpcao} onClick={() => { setModo('ia-texto'); setSugestao(null); }}>✦ Texto</button>
                <label className={styles.iaOpcao}>
                  📷 Foto
                  <input ref={fotoRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && processarFoto(e.target.files[0])} />
                </label>
              </div>
              <button className={styles.modalClose} onClick={() => { setModo('lista'); setSugestao(null); }}>×</button>
            </div>

            {sugestao && (
              <div className={styles.sugestaoBox}>
                <span className={styles.sugestaoLabel}>✦ Preenchido pela IA — confirme os dados</span>
                <span className={`${styles.confianca} ${sugestao.confianca === 'alta' ? styles.confAlta : sugestao.confianca === 'media' ? styles.confMedia : styles.confBaixa}`}>
                  Confiança {sugestao.confianca}
                </span>
              </div>
            )}

            <div className={styles.formBody}>
              {/* Tipo */}
              <div className={styles.tipoRow}>
                {(['entrada', 'debito', 'credito'] as const).map(t => (
                  <button key={t} className={`${styles.tipoBtn} ${form.tipo === t ? styles.tipoBtnAtivo : ''}`}
                    style={form.tipo === t ? { borderColor: t === 'entrada' ? 'var(--green)' : t === 'debito' ? 'var(--red)' : 'var(--blue)', color: t === 'entrada' ? 'var(--green)' : t === 'debito' ? 'var(--red)' : 'var(--blue)' } : {}}
                    onClick={() => setForm(f => ({ ...f, tipo: t, categoriaId: '', planejamentoId: '', cartaoId: '' }))}>
                    {t === 'entrada' ? '↑ Entrada' : t === 'debito' ? '↓ Débito' : '💳 Crédito'}
                  </button>
                ))}
              </div>

              <div className={styles.formGrid}>
                <div className={styles.formGrupo} style={{ gridColumn: '1/-1' }}>
                  <label className={styles.label}>Descrição *</label>
                  <input className={styles.input} value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Ex: Supermercado" />
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
                    {categoriasFiltradas.map(c => <option key={c.id} value={c.id}>{c.icone} {c.nome}</option>)}
                  </select>
                </div>
                {form.tipo !== 'entrada' && (
                  <div className={styles.formGrupo}>
                    <label className={styles.label}>Planejamento</label>
                    <select className={styles.input} value={form.planejamentoId} onChange={e => setForm(f => ({ ...f, planejamentoId: e.target.value }))}>
                      <option value="">Sem planejamento</option>
                      {config.planejamentos.filter(p => p.ativo).map(p => <option key={p.id} value={p.id}>{p.nome} ({p.percentual}%)</option>)}
                    </select>
                  </div>
                )}
                {form.tipo === 'credito' && (
                  <div className={styles.formGrupo}>
                    <label className={styles.label}>Cartão</label>
                    <select className={styles.input} value={form.cartaoId} onChange={e => setForm(f => ({ ...f, cartaoId: e.target.value }))}>
                      <option value="">Selecionar cartão</option>
                      {config.cartoes.filter(c => c.ativo).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                    </select>
                  </div>
                )}
                <div className={styles.formGrupo} style={{ gridColumn: '1/-1' }}>
                  <label className={styles.label}>Observação</label>
                  <input className={styles.input} value={form.observacao} onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))} placeholder="Opcional" />
                </div>
              </div>

              <button className={styles.btnSalvar} onClick={() => salvar(form)} disabled={salvando || !form.descricao || !form.valor}>
                {salvando ? <span className="loading" style={{ borderTopColor: '#000' }} /> : '✓ Salvar lançamento'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal IA texto */}
      {modo === 'ia-texto' && (
        <div className="modal-overlay" onClick={() => setModo('lista')}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ padding: '1.5rem' }}>
            <h2 className={styles.modalTitulo} style={{ marginBottom: '1rem' }}>✦ Registrar com IA</h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--text2)', marginBottom: '1rem' }}>
              Descreva o gasto em linguagem natural. Ex: "Gastei 45 reais no mercado hoje"
            </p>
            <textarea
              className={styles.input}
              rows={4}
              style={{ resize: 'none', marginBottom: '0.75rem' }}
              value={iaTexto}
              onChange={e => setIaTexto(e.target.value)}
              placeholder="Descreva o lançamento..."
              autoFocus
            />
            <button className={styles.btnSalvar} onClick={processarTextoIA} disabled={iaLoading || !iaTexto.trim()}>
              {iaLoading ? <span className="loading" style={{ borderTopColor: '#000' }} /> : '✦ Interpretar'}
            </button>
          </div>
        </div>
      )}

      {/* Modal chat */}
      {modo === 'chat' && (
        <div className="modal-overlay" onClick={() => setModo('lista')}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', height: '80vh' }}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitulo}>✦ Assistente Financeiro</h2>
              <button className={styles.modalClose} onClick={() => setModo('lista')}>×</button>
            </div>
            <div ref={chatRef} className={styles.chatMsgs}>
              {chat.length === 0 && (
                <div className={styles.chatVazio}>
                  <p>Olá! Pergunte qualquer coisa sobre suas finanças.</p>
                  <p style={{ marginTop: '0.5rem', fontSize: '0.78rem' }}>Ex: "Quanto gastei com alimentação este mês?"</p>
                </div>
              )}
              {chat.map((m, i) => (
                <div key={i} className={`${styles.chatMsg} ${m.role === 'user' ? styles.chatUser : styles.chatBot}`}>
                  {m.content}
                </div>
              ))}
            </div>
            <div className={styles.chatInput}>
              <input
                className={styles.input}
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && enviarChat()}
                placeholder="Pergunte algo..."
              />
              <button className={styles.chatSend} onClick={enviarChat} disabled={!chatInput.trim()}>→</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
