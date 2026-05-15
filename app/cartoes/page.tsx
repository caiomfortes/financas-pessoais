'use client';

import { useEffect, useState } from 'react';
import Nav from '@/components/Nav';
import { Config, DadosMes, Fatura } from '@/lib/types';
import { formatarValor, mesAtual, formatarMesLongo, mesAnterior, mesProximo } from '@/lib/financas';
import styles from './cartoes.module.css';

export default function CartoesPage() {
  const [config, setConfig] = useState<Config | null>(null);
  const [dados, setDados] = useState<DadosMes | null>(null);
  const [mes, setMes] = useState(mesAtual());
  const [detalheCartao, setDetalheCartao] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/config').then(r => r.json()).then(setConfig);
  }, []);

  useEffect(() => {
    fetch(`/api/lancamentos?mes=${mes}`).then(r => r.json()).then(setDados);
  }, [mes]);

  if (!config || !dados) return null;

  const cartoes = config.cartoes.filter(c => c.ativo);

  // Para cada cartão, faturas a pagar neste mês
  const faturasMes = dados.faturas.filter(f => f.mesCobranca === mes);

  const pagarFatura = async (fatura: Fatura) => {
    // Marca fatura como paga — simplificado: registra um débito
    const r = await fetch('/api/lancamentos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tipo: 'debito',
        descricao: `Fatura ${config.cartoes.find(c => c.id === fatura.cartaoId)?.nome} — ${fatura.mes}`,
        valor: getValorFatura(fatura),
        data: new Date().toISOString().slice(0, 10),
        categoriaId: '',
        observacao: 'Pagamento de fatura de cartão',
      }),
    });
    if (r.ok) fetch(`/api/lancamentos?mes=${mes}`).then(r => r.json()).then(setDados);
  };

  const getValorFatura = (fatura: Fatura): number => {
    // Busca lançamentos do mês de referência — simplificado usa IDs
    return fatura.lancamentoIds.length * 0; // será calculado via detalhe
  };

  // Gastos no crédito neste mês (vão pro próximo)
  const gastosCredito = dados.lancamentos.filter(l => l.tipo === 'credito');

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

        {/* Cartões visuais */}
        <div className={styles.cartoesGrid}>
          {cartoes.length === 0 && (
            <div className={styles.vazio}>
              <p>Nenhum cartão cadastrado.</p>
              <a href="/configuracoes" style={{ color: 'var(--accent)', fontSize: '0.82rem' }}>Adicionar em Configurações →</a>
            </div>
          )}
          {cartoes.map(c => {
            const fatura = faturasMes.find(f => f.cartaoId === c.id);
            const gastosDoMes = gastosCredito.filter(l => l.cartaoId === c.id);
            const totalGastosMes = gastosDoMes.reduce((s, l) => s + l.valor, 0);
            const pctLimite = c.limite > 0 ? (totalGastosMes / c.limite) * 100 : 0;

            return (
              <div key={c.id} className={styles.cartaoCard} style={{ '--cor': c.cor } as React.CSSProperties}>
                <div className={styles.cartaoTop}>
                  <div>
                    <div className={styles.cartaoBandeira}>{c.bandeira}</div>
                    <div className={styles.cartaoNome}>{c.nome}</div>
                  </div>
                  <div className={styles.cartaoChip}>◈</div>
                </div>
                <div className={styles.cartaoInfo}>
                  <div>
                    <div className={styles.cartaoLabel}>Gasto este mês</div>
                    <div className={styles.cartaoVal}>{formatarValor(totalGastosMes)}</div>
                  </div>
                  <div>
                    <div className={styles.cartaoLabel}>Limite</div>
                    <div className={styles.cartaoVal}>{formatarValor(c.limite)}</div>
                  </div>
                </div>
                {c.limite > 0 && (
                  <div className={styles.cartaoBar}>
                    <div className={styles.cartaoBarFill} style={{ width: `${Math.min(pctLimite, 100)}%`, background: pctLimite > 80 ? 'var(--red)' : 'rgba(255,255,255,0.8)' }} />
                  </div>
                )}
                <div className={styles.cartaoFooter}>
                  <span>Fecha dia {c.diaFechamento}</span>
                  {gastosDoMes.length > 0 && (
                    <button className={styles.btnDetalhe} onClick={() => setDetalheCartao(detalheCartao === c.id ? null : c.id)}>
                      {gastosDoMes.length} gasto{gastosDoMes.length > 1 ? 's' : ''} →
                    </button>
                  )}
                </div>

                {detalheCartao === c.id && gastosDoMes.length > 0 && (
                  <div className={styles.detalheList}>
                    {gastosDoMes.map(l => {
                      const cat = config.categorias.find(cat => cat.id === l.categoriaId);
                      return (
                        <div key={l.id} className={styles.detalheItem}>
                          <span className={styles.detalheIcon}>{cat?.icone || '·'}</span>
                          <span className={styles.detalheDesc}>{l.descricao}</span>
                          <span className={styles.detalheData}>{l.data}</span>
                          <span className={styles.detalheVal}>{formatarValor(l.valor)}</span>
                        </div>
                      );
                    })}
                    <div className={styles.detalheTotalRow}>
                      <span>Total</span>
                      <span style={{ fontFamily: 'var(--font-mono)' }}>{formatarValor(totalGastosMes)}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Faturas a pagar */}
        {faturasMes.length > 0 && (
          <div className={styles.secao}>
            <h2 className={styles.secaoTitulo}>Faturas a pagar este mês</h2>
            {faturasMes.map(fatura => {
              const cartao = config.cartoes.find(c => c.id === fatura.cartaoId);
              return (
                <div key={`${fatura.cartaoId}-${fatura.mes}`} className={`${styles.faturaItem} ${fatura.paga ? styles.faturaPaga : ''}`}>
                  <div className={styles.faturaInfo}>
                    <span className={styles.faturaCartao}>{cartao?.nome}</span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text3)' }}>Ref. {fatura.mes} · {fatura.lancamentoIds.length} itens</span>
                  </div>
                  <div className={styles.faturaAcoes}>
                    {fatura.paga
                      ? <span className={styles.faturaTag}>✓ Paga</span>
                      : <button className={styles.btnPagar} onClick={() => pagarFatura(fatura)}>Marcar pago</button>
                    }
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {faturasMes.length === 0 && gastosCredito.length === 0 && (
          <div className={styles.vazio} style={{ marginTop: '2rem' }}>
            <p>Nenhum gasto no crédito e nenhuma fatura neste mês.</p>
          </div>
        )}
      </main>
    </div>
  );
}
