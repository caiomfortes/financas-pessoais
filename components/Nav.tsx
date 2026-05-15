'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './nav.module.css';

const itens = [
  { href: '/', label: 'Dashboard', icon: '◈' },
  { href: '/lancamentos', label: 'Lançamentos', icon: '↕' },
  { href: '/cartoes', label: 'Cartões', icon: '▭' },
  { href: '/planejamento', label: 'Planejar', icon: '◎' },
  { href: '/relatorios', label: 'Relatórios', icon: '▲' },
  { href: '/configuracoes', label: 'Config', icon: '⊙' },
];

export default function Nav() {
  const path = usePathname();

  return (
    <>
      {/* Sidebar desktop */}
      <aside className={styles.sidebar}>
        <div className={styles.logo}>
          <span className={styles.logoIcon}>◈</span>
          <span className={styles.logoText}>Finanças</span>
        </div>
        <nav className={styles.sidebarNav}>
          {itens.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.sidebarItem} ${path === item.href ? styles.active : ''}`}
            >
              <span className={styles.itemIcon}>{item.icon}</span>
              <span className={styles.itemLabel}>{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className={styles.sidebarFooter}>
          <button
            className={styles.logoutBtn}
            onClick={async () => {
              await fetch('/api/auth', { method: 'DELETE' });
              window.location.href = '/login';
            }}
          >
            ⎋ Sair
          </button>
        </div>
      </aside>

      {/* Bottom nav mobile */}
      <nav className={styles.bottomNav}>
        {itens.slice(0, 5).map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={`${styles.bottomItem} ${path === item.href ? styles.active : ''}`}
          >
            <span className={styles.bottomIcon}>{item.icon}</span>
            <span className={styles.bottomLabel}>{item.label}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}
