'use client';

import { useState, useRef, useEffect } from 'react';
import styles from './login.module.css';

export default function LoginPage() {
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const entrar = async () => {
    if (!senha.trim()) return;
    setLoading(true);
    setErro(false);

    const r = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: senha }),
    });

    if (r.ok) {
      window.location.href = '/';
    } else {
      setErro(true);
      setSenha('');
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.bg}>
        <div className={styles.orb1} />
        <div className={styles.orb2} />
      </div>

      <div className={styles.box}>
        <div className={styles.icon}>◈</div>
        <h1 className={styles.titulo}>Finanças</h1>
        <p className={styles.sub}>Acesso restrito</p>

        <div className={styles.form}>
          <input
            ref={inputRef}
            type="password"
            className={`${styles.input} ${erro ? styles.inputErro : ''}`}
            placeholder="Sua senha"
            value={senha}
            onChange={e => setSenha(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && entrar()}
          />
          {erro && <p className={styles.erro}>Senha incorreta</p>}
          <button className={styles.btn} onClick={entrar} disabled={loading || !senha.trim()}>
            {loading ? <span className="loading" /> : 'Entrar'}
          </button>
        </div>
      </div>
    </div>
  );
}
