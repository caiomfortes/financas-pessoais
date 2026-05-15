'use client';

import { useEffect, useState } from 'react';
import Nav from '@/components/Nav';
import { Config, Categoria, Planejamento, Cartao, DespesaFixa } from '@/lib/types';
import { uid, formatarValor } from '@/lib/financas';
import styles from './config.module.css';

type Aba = 'geral' | 'categorias' | 'planejamentos' | 'cartoes' | 'fixas' | 'exportar';

const CORES = ['#00d68f','#4d9eff','#ff4d6d','#ffb347','#a78bfa','#f472b6','#34d399','#60a5fa','#fb923c','#e879f9'];
const ICONES = ['💰','💻','🍽️','🚗','❤️','🎉','🏠','📚','✈️','🛍️','💊','🎮','☕','🐾','💇','🏋️','📱','🎵','🌐','💡'];

export default function ConfiguracoesPage() {
  const [config, setConfig] = useState<Config | null>(null);
  const [aba, setAba] = useState<Aba>('geral');
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState('');
  const [exportDe, setExportDe] = useState('');
  const [exportAte, setExportAte] = useState('');

  useEffect(() => {
    fetch('/api/config').then(r => r.json()).then(c => {
      setConfig(c);
      const mes = new Date().toISOString().slice(0, 7);
      setExportDe(mes); setExportAte(mes);
    });
  }, []);

  const salvar = async (novoConfig?: Config) => {
    const c = novoConfig || config;
    if (!c) return;
    setSalvando(true);
    await fetch('/api/config', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(c) });
    setSalvando(false);
    setMsg('✓ Salvo!');
    setTimeout(() => setMsg(''), 2000);
  };

  const exportar = () => {
    window.open(`/api/exportar?de=${exportDe}&ate=${exportAte}`);
  };

  if (!config) return null;

  return (
    <div className={styles.layout}>
      <Nav />
      <main className={styles.main}>
        <div className={styles.header}>
          <h1 className={styles.titulo}>Configurações</h1>
          {msg && <span className={styles.msg}>{msg}</span>}
        </div>

        <div className={styles.abas}>
          {(['geral','categorias','planejamentos','cartoes','fixas','exportar'] as Aba[]).map(a => (
            <button key={a} className={`${styles.aba} ${aba === a ? styles.abaAtiva : ''}`} onClick={() => setAba(a)}>
              {a === 'geral' ? 'Geral' : a === 'categorias' ? 'Categorias' : a === 'planejamentos' ? 'Planejamentos' : a === 'cartoes' ? 'Cartões' : a === 'fixas' ? 'Fixas' : 'Exportar'}
            </button>
          ))}
        </div>

        {/* Geral */}
        {aba === 'geral' && (
          <div className={styles.secao}>
            <div className={styles.formGrupo}>
              <label className={styles.label}>Seu nome</label>
              <input className={styles.input} value={config.nomeUsuario} onChange={e => setConfig(c => c ? ({ ...c, nomeUsuario: e.target.value }) : c)} />
            </div>
            <div className={styles.formGrupo}>
              <label className={styles.label}>Renda mensal esperada (R$)</label>
              <input className={styles.input} type="number" min="0" value={config.rendaMensal} onChange={e => setConfig(c => c ? ({ ...c, rendaMensal: Number(e.target.value) }) : c)} placeholder="0" />
              <p className={styles.hint}>Usado para calcular os % dos planejamentos</p>
            </div>
            <div className={styles.formGrupo}>
              <label className={styles.label}>Alterar senha</label>
              <SenhaForm />
            </div>
            <button className={styles.btnSalvar} onClick={() => salvar()} disabled={salvando}>
              {salvando ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        )}

        {/* Categorias */}
        {aba === 'categorias' && (
          <CategoriaEditor config={config} setConfig={setConfig} salvar={salvar} />
        )}

        {/* Planejamentos */}
        {aba === 'planejamentos' && (
          <PlanejamentoEditor config={config} setConfig={setConfig} salvar={salvar} />
        )}

        {/* Cartões */}
        {aba === 'cartoes' && (
          <CartaoEditor config={config} setConfig={setConfig} salvar={salvar} />
        )}

        {/* Fixas */}
        {aba === 'fixas' && (
          <FixasEditor config={config} setConfig={setConfig} salvar={salvar} />
        )}

        {/* Exportar */}
        {aba === 'exportar' && (
          <div className={styles.secao}>
            <h2 className={styles.secaoTitulo}>Exportar planilha</h2>
            <p className={styles.hint} style={{ marginBottom: '1rem' }}>Exporta todas as entradas e saídas em débito (sem crédito) para Excel.</p>
            <div className={styles.row2}>
              <div className={styles.formGrupo}>
                <label className={styles.label}>De</label>
                <input className={styles.input} type="month" value={exportDe} onChange={e => setExportDe(e.target.value)} />
              </div>
              <div className={styles.formGrupo}>
                <label className={styles.label}>Até</label>
                <input className={styles.input} type="month" value={exportAte} onChange={e => setExportAte(e.target.value)} />
              </div>
            </div>
            <button className={styles.btnSalvar} onClick={exportar}>⬇ Baixar planilha</button>
          </div>
        )}
      </main>
    </div>
  );
}

function SenhaForm() {
  const [nova, setNova] = useState('');
  const [msg, setMsg] = useState('');
  const alterar = async () => {
    if (!nova.trim()) return;
    // Aqui em produção enviaria para API — por ora orienta o usuário
    setMsg('Altere APP_PASSWORD nas variáveis de ambiente da Vercel e faça redeploy.');
    setTimeout(() => setMsg(''), 5000);
  };
  return (
    <div style={{ display: 'flex', gap: '0.5rem', flexDirection: 'column' }}>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <input className={styles.input} type="password" value={nova} onChange={e => setNova(e.target.value)} placeholder="Nova senha" style={{ flex: 1 }} />
        <button className={styles.btnSmall} onClick={alterar}>Alterar</button>
      </div>
      {msg && <p style={{ fontSize: '0.75rem', color: 'var(--amber)' }}>{msg}</p>}
    </div>
  );
}

function CategoriaEditor({ config, setConfig, salvar }: { config: Config; setConfig: any; salvar: any }) {
  const [nova, setNova] = useState<{ nome: string; tipo: 'entrada' | 'despesa'; cor: string; icone: string }>({ nome: '', tipo: 'despesa', cor: CORES[0], icone: '🛍️' });

  const adicionar = () => {
    if (!nova.nome) return;
    const cat: Categoria = { id: uid(), ...nova };
    const novoConfig = { ...config, categorias: [...config.categorias, cat] };
    setConfig(novoConfig);
    salvar(novoConfig);
    setNova(n => ({ ...n, nome: '' }));
  };

  const remover = (id: string) => {
    const novoConfig = { ...config, categorias: config.categorias.filter(c => c.id !== id) };
    setConfig(novoConfig);
    salvar(novoConfig);
  };

  return (
    <div className={styles.secao}>
      <div className={styles.secaoGrupo}>
        <h3 className={styles.secaoTitulo}>Entradas</h3>
        {config.categorias.filter(c => c.tipo === 'entrada').map(c => (
          <div key={c.id} className={styles.item}>
            <span style={{ fontSize: '1.1rem' }}>{c.icone}</span>
            <span className={styles.itemNome}>{c.nome}</span>
            <span className={styles.cor} style={{ background: c.cor }} />
            <button className={styles.btnDel} onClick={() => remover(c.id)}>×</button>
          </div>
        ))}
      </div>
      <div className={styles.secaoGrupo}>
        <h3 className={styles.secaoTitulo}>Despesas</h3>
        {config.categorias.filter(c => c.tipo === 'despesa').map(c => (
          <div key={c.id} className={styles.item}>
            <span style={{ fontSize: '1.1rem' }}>{c.icone}</span>
            <span className={styles.itemNome}>{c.nome}</span>
            <span className={styles.cor} style={{ background: c.cor }} />
            <button className={styles.btnDel} onClick={() => remover(c.id)}>×</button>
          </div>
        ))}
      </div>

      <div className={styles.novaItem}>
        <h3 className={styles.secaoTitulo}>Nova categoria</h3>
        <div className={styles.formGrid}>
          <div className={styles.formGrupo}>
            <label className={styles.label}>Nome</label>
            <input className={styles.input} value={nova.nome} onChange={e => setNova(n => ({ ...n, nome: e.target.value }))} placeholder="Ex: Streaming" />
          </div>
          <div className={styles.formGrupo}>
            <label className={styles.label}>Tipo</label>
            <select className={styles.input} value={nova.tipo} onChange={e => setNova(n => ({ ...n, tipo: e.target.value as any }))}>
              <option value="entrada">Entrada</option>
              <option value="despesa">Despesa</option>
            </select>
          </div>
        </div>
        <div className={styles.formGrupo}>
          <label className={styles.label}>Ícone</label>
          <div className={styles.iconeGrid}>
            {ICONES.map(ic => (
              <button key={ic} className={`${styles.iconeBtn} ${nova.icone === ic ? styles.iconeBtnAtivo : ''}`} onClick={() => setNova(n => ({ ...n, icone: ic }))}>{ic}</button>
            ))}
          </div>
        </div>
        <div className={styles.formGrupo}>
          <label className={styles.label}>Cor</label>
          <div className={styles.coresGrid}>
            {CORES.map(cor => (
              <button key={cor} className={`${styles.corBtn} ${nova.cor === cor ? styles.corBtnAtiva : ''}`} style={{ background: cor }} onClick={() => setNova(n => ({ ...n, cor }))} />
            ))}
          </div>
        </div>
        <button className={styles.btnSalvar} onClick={adicionar}>+ Adicionar</button>
      </div>
    </div>
  );
}

function PlanejamentoEditor({ config, setConfig, salvar }: { config: Config; setConfig: any; salvar: any }) {
  const [novo, setNovo] = useState({ nome: '', percentual: '10', cor: CORES[0] });
  const total = config.planejamentos.filter(p => p.ativo).reduce((s, p) => s + p.percentual, 0);

  const adicionar = () => {
    if (!novo.nome || !novo.percentual) return;
    const p: Planejamento = { id: uid(), nome: novo.nome, percentual: Number(novo.percentual), cor: novo.cor, ativo: true };
    const novoConfig = { ...config, planejamentos: [...config.planejamentos, p] };
    setConfig(novoConfig); salvar(novoConfig);
    setNovo(n => ({ ...n, nome: '' }));
  };

  const toggleAtivo = (id: string) => {
    const novoConfig = { ...config, planejamentos: config.planejamentos.map(p => p.id === id ? { ...p, ativo: !p.ativo } : p) };
    setConfig(novoConfig); salvar(novoConfig);
  };

  const remover = (id: string) => {
    const novoConfig = { ...config, planejamentos: config.planejamentos.filter(p => p.id !== id) };
    setConfig(novoConfig); salvar(novoConfig);
  };

  return (
    <div className={styles.secao}>
      <div className={styles.totalPct}>
        <span>Total alocado:</span>
        <span style={{ color: total > 100 ? 'var(--red)' : total === 100 ? 'var(--green)' : 'var(--amber)', fontFamily: 'var(--font-mono)' }}>{total}%</span>
        {total > 100 && <span style={{ color: 'var(--red)', fontSize: '0.75rem' }}>⚠ Ultrapassa 100%</span>}
      </div>

      {config.planejamentos.map(p => (
        <div key={p.id} className={`${styles.item} ${!p.ativo ? styles.itemInativo : ''}`}>
          <span className={styles.cor} style={{ background: p.cor }} />
          <span className={styles.itemNome}>{p.nome}</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--text2)', marginLeft: 'auto' }}>{p.percentual}%</span>
          <button className={styles.btnSmall} onClick={() => toggleAtivo(p.id)}>{p.ativo ? 'Encerrar' : 'Ativar'}</button>
          <button className={styles.btnDel} onClick={() => remover(p.id)}>×</button>
        </div>
      ))}

      <div className={styles.novaItem}>
        <h3 className={styles.secaoTitulo}>Novo planejamento</h3>
        <div className={styles.formGrid}>
          <div className={styles.formGrupo}>
            <label className={styles.label}>Nome</label>
            <input className={styles.input} value={novo.nome} onChange={e => setNovo(n => ({ ...n, nome: e.target.value }))} placeholder="Ex: Investimentos" />
          </div>
          <div className={styles.formGrupo}>
            <label className={styles.label}>Percentual (%)</label>
            <input className={styles.input} type="number" min="1" max="100" value={novo.percentual} onChange={e => setNovo(n => ({ ...n, percentual: e.target.value }))} />
          </div>
        </div>
        <div className={styles.formGrupo}>
          <label className={styles.label}>Cor</label>
          <div className={styles.coresGrid}>
            {CORES.map(cor => (
              <button key={cor} className={`${styles.corBtn} ${novo.cor === cor ? styles.corBtnAtiva : ''}`} style={{ background: cor }} onClick={() => setNovo(n => ({ ...n, cor }))} />
            ))}
          </div>
        </div>
        <button className={styles.btnSalvar} onClick={adicionar}>+ Adicionar</button>
      </div>
    </div>
  );
}

function CartaoEditor({ config, setConfig, salvar }: { config: Config; setConfig: any; salvar: any }) {
  const [novo, setNovo] = useState({ nome: '', bandeira: 'Visa', cor: '#4d9eff', limite: '', diaFechamento: '10' });

  const adicionar = () => {
    if (!novo.nome) return;
    const c: Cartao = { id: uid(), nome: novo.nome, bandeira: novo.bandeira, cor: novo.cor, limite: Number(novo.limite), diaFechamento: Number(novo.diaFechamento), ativo: true };
    const novoConfig = { ...config, cartoes: [...config.cartoes, c] };
    setConfig(novoConfig); salvar(novoConfig);
    setNovo(n => ({ ...n, nome: '', limite: '' }));
  };

  const toggleAtivo = (id: string) => {
    const novoConfig = { ...config, cartoes: config.cartoes.map(c => c.id === id ? { ...c, ativo: !c.ativo } : c) };
    setConfig(novoConfig); salvar(novoConfig);
  };

  return (
    <div className={styles.secao}>
      {config.cartoes.map(c => (
        <div key={c.id} className={`${styles.item} ${!c.ativo ? styles.itemInativo : ''}`}>
          <span className={styles.cor} style={{ background: c.cor }} />
          <div className={styles.itemInfo}>
            <span className={styles.itemNome}>{c.nome}</span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text3)' }}>{c.bandeira} · fecha dia {c.diaFechamento} · limite {formatarValor(c.limite)}</span>
          </div>
          <button className={styles.btnSmall} onClick={() => toggleAtivo(c.id)}>{c.ativo ? 'Encerrar' : 'Ativar'}</button>
        </div>
      ))}

      <div className={styles.novaItem}>
        <h3 className={styles.secaoTitulo}>Novo cartão</h3>
        <div className={styles.formGrid}>
          <div className={styles.formGrupo}>
            <label className={styles.label}>Nome do cartão</label>
            <input className={styles.input} value={novo.nome} onChange={e => setNovo(n => ({ ...n, nome: e.target.value }))} placeholder="Ex: Nubank" />
          </div>
          <div className={styles.formGrupo}>
            <label className={styles.label}>Bandeira</label>
            <select className={styles.input} value={novo.bandeira} onChange={e => setNovo(n => ({ ...n, bandeira: e.target.value }))}>
              {['Visa','Mastercard','Elo','Amex','Hipercard'].map(b => <option key={b}>{b}</option>)}
            </select>
          </div>
          <div className={styles.formGrupo}>
            <label className={styles.label}>Limite (R$)</label>
            <input className={styles.input} type="number" value={novo.limite} onChange={e => setNovo(n => ({ ...n, limite: e.target.value }))} placeholder="5000" />
          </div>
          <div className={styles.formGrupo}>
            <label className={styles.label}>Dia de fechamento</label>
            <input className={styles.input} type="number" min="1" max="31" value={novo.diaFechamento} onChange={e => setNovo(n => ({ ...n, diaFechamento: e.target.value }))} />
          </div>
        </div>
        <div className={styles.formGrupo}>
          <label className={styles.label}>Cor do cartão</label>
          <div className={styles.coresGrid}>
            {CORES.map(cor => (
              <button key={cor} className={`${styles.corBtn} ${novo.cor === cor ? styles.corBtnAtiva : ''}`} style={{ background: cor }} onClick={() => setNovo(n => ({ ...n, cor }))} />
            ))}
          </div>
        </div>
        <button className={styles.btnSalvar} onClick={adicionar}>+ Adicionar cartão</button>
      </div>
    </div>
  );
}

function FixasEditor({ config, setConfig, salvar }: { config: Config; setConfig: any; salvar: any }) {
  const [nova, setNova] = useState<{ nome: string; valor: string; tipo: 'debito' | 'credito'; cartaoId: string; categoriaId: string; planejamentoId: string; diaVencimento: string; parcelamentoTotal: string; parcelamentoMesInicio: string }>({ nome: '', valor: '', tipo: 'debito', cartaoId: '', categoriaId: '', planejamentoId: '', diaVencimento: '1', parcelamentoTotal: '', parcelamentoMesInicio: new Date().toISOString().slice(0, 7) });

  const adicionar = () => {
    if (!nova.nome || !nova.valor) return;
    const f: DespesaFixa = {
      id: uid(), nome: nova.nome, valor: Number(nova.valor), tipo: nova.tipo,
      cartaoId: nova.cartaoId || undefined, categoriaId: nova.categoriaId,
      planejamentoId: nova.planejamentoId || undefined, diaVencimento: Number(nova.diaVencimento), ativa: true,
      parcelamento: nova.parcelamentoTotal ? { total: Number(nova.parcelamentoTotal), atual: 1, mesInicio: nova.parcelamentoMesInicio } : undefined,
    };
    const novoConfig = { ...config, despesasFixas: [...config.despesasFixas, f] };
    setConfig(novoConfig); salvar(novoConfig);
    setNova(n => ({ ...n, nome: '', valor: '' }));
  };

  const toggleAtiva = (id: string) => {
    const novoConfig = { ...config, despesasFixas: config.despesasFixas.map(f => f.id === id ? { ...f, ativa: !f.ativa } : f) };
    setConfig(novoConfig); salvar(novoConfig);
  };

  return (
    <div className={styles.secao}>
      {config.despesasFixas.map(f => {
        const cat = config.categorias.find(c => c.id === f.categoriaId);
        const cartao = config.cartoes.find(c => c.id === f.cartaoId);
        return (
          <div key={f.id} className={`${styles.item} ${!f.ativa ? styles.itemInativo : ''}`}>
            <div className={styles.itemInfo}>
              <span className={styles.itemNome}>{f.nome}</span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text3)' }}>
                {f.tipo === 'debito' ? 'Débito' : `Crédito${cartao ? ` · ${cartao.nome}` : ''}`}
                {cat ? ` · ${cat.nome}` : ''} · dia {f.diaVencimento}
                {f.parcelamento ? ` · ${f.parcelamento.total}x` : ''}
              </span>
            </div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.88rem', marginLeft: 'auto' }}>{formatarValor(f.valor)}</span>
            <button className={styles.btnSmall} onClick={() => toggleAtiva(f.id)}>{f.ativa ? 'Encerrar' : 'Ativar'}</button>
          </div>
        );
      })}

      <div className={styles.novaItem}>
        <h3 className={styles.secaoTitulo}>Nova despesa fixa</h3>
        <div className={styles.formGrid}>
          <div className={styles.formGrupo} style={{ gridColumn: '1/-1' }}>
            <label className={styles.label}>Nome</label>
            <input className={styles.input} value={nova.nome} onChange={e => setNova(n => ({ ...n, nome: e.target.value }))} placeholder="Ex: Netflix" />
          </div>
          <div className={styles.formGrupo}>
            <label className={styles.label}>Valor (R$)</label>
            <input className={styles.input} type="number" value={nova.valor} onChange={e => setNova(n => ({ ...n, valor: e.target.value }))} placeholder="0,00" />
          </div>
          <div className={styles.formGrupo}>
            <label className={styles.label}>Dia do vencimento</label>
            <input className={styles.input} type="number" min="1" max="31" value={nova.diaVencimento} onChange={e => setNova(n => ({ ...n, diaVencimento: e.target.value }))} />
          </div>
          <div className={styles.formGrupo}>
            <label className={styles.label}>Tipo</label>
            <select className={styles.input} value={nova.tipo} onChange={e => setNova(n => ({ ...n, tipo: e.target.value as any }))}>
              <option value="debito">Débito</option>
              <option value="credito">Crédito</option>
            </select>
          </div>
          {nova.tipo === 'credito' && (
            <div className={styles.formGrupo}>
              <label className={styles.label}>Cartão</label>
              <select className={styles.input} value={nova.cartaoId} onChange={e => setNova(n => ({ ...n, cartaoId: e.target.value }))}>
                <option value="">Selecionar</option>
                {config.cartoes.filter(c => c.ativo).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
          )}
          <div className={styles.formGrupo}>
            <label className={styles.label}>Categoria</label>
            <select className={styles.input} value={nova.categoriaId} onChange={e => setNova(n => ({ ...n, categoriaId: e.target.value }))}>
              <option value="">Sem categoria</option>
              {config.categorias.filter(c => c.tipo === 'despesa').map(c => <option key={c.id} value={c.id}>{c.icone} {c.nome}</option>)}
            </select>
          </div>
          <div className={styles.formGrupo}>
            <label className={styles.label}>Planejamento</label>
            <select className={styles.input} value={nova.planejamentoId} onChange={e => setNova(n => ({ ...n, planejamentoId: e.target.value }))}>
              <option value="">Sem planejamento</option>
              {config.planejamentos.filter(p => p.ativo).map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </div>
          {nova.tipo === 'credito' && (
            <>
              <div className={styles.formGrupo}>
                <label className={styles.label}>Parcelamento (total de vezes, opcional)</label>
                <input className={styles.input} type="number" min="2" value={nova.parcelamentoTotal} onChange={e => setNova(n => ({ ...n, parcelamentoTotal: e.target.value }))} placeholder="Ex: 12" />
              </div>
              {nova.parcelamentoTotal && (
                <div className={styles.formGrupo}>
                  <label className={styles.label}>Mês de início</label>
                  <input className={styles.input} type="month" value={nova.parcelamentoMesInicio} onChange={e => setNova(n => ({ ...n, parcelamentoMesInicio: e.target.value }))} />
                </div>
              )}
            </>
          )}
        </div>
        <button className={styles.btnSalvar} onClick={adicionar}>+ Adicionar</button>
      </div>
    </div>
  );
}
