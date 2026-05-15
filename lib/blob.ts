import { list, put, del } from '@vercel/blob';
import { Config, DadosMes } from './types';

// ── Helpers ───────────────────────────────────────────────

async function getBlob<T>(key: string, fallback: T): Promise<T> {
  try {
    const { blobs } = await list({ prefix: key });
    if (blobs.length === 0) return fallback;
    blobs.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
    const res = await fetch(blobs[0].url, { cache: 'no-store' });
    return await res.json();
  } catch { return fallback; }
}

async function saveBlob(key: string, data: unknown): Promise<void> {
  const { blobs } = await list({ prefix: key });
  if (blobs.length > 0) await Promise.all(blobs.map(b => del(b.url)));
  await put(key, JSON.stringify(data), {
    access: 'public',
    addRandomSuffix: false,
    contentType: 'application/json',
  });
}

// ── Config ────────────────────────────────────────────────

const CONFIG_KEY = 'financas/config.json';

export async function getConfig(): Promise<Config> {
  return getBlob<Config>(CONFIG_KEY, defaultConfig());
}

export async function saveConfig(config: Config): Promise<void> {
  await saveBlob(CONFIG_KEY, config);
}

function defaultConfig(): Config {
  return {
    nomeUsuario: 'Você',
    rendaMensal: 0,
    mesInicio: new Date().toISOString().slice(0, 7),
    categorias: [
      { id: 'c1', nome: 'Salário', tipo: 'entrada', cor: '#22c55e', icone: '💰' },
      { id: 'c2', nome: 'Freelance', tipo: 'entrada', cor: '#3b82f6', icone: '💻' },
      { id: 'c3', nome: 'Alimentação', tipo: 'despesa', cor: '#f97316', icone: '🍽️' },
      { id: 'c4', nome: 'Transporte', tipo: 'despesa', cor: '#8b5cf6', icone: '🚗' },
      { id: 'c5', nome: 'Saúde', tipo: 'despesa', cor: '#ec4899', icone: '❤️' },
      { id: 'c6', nome: 'Lazer', tipo: 'despesa', cor: '#f59e0b', icone: '🎉' },
      { id: 'c7', nome: 'Moradia', tipo: 'despesa', cor: '#06b6d4', icone: '🏠' },
      { id: 'c8', nome: 'Educação', tipo: 'despesa', cor: '#10b981', icone: '📚' },
    ],
    planejamentos: [
      { id: 'p1', nome: 'Necessidades', percentual: 50, cor: '#3b82f6', ativo: true },
      { id: 'p2', nome: 'Investimentos', percentual: 20, cor: '#22c55e', ativo: true },
      { id: 'p3', nome: 'Lazer', percentual: 30, cor: '#f59e0b', ativo: true },
    ],
    cartoes: [],
    despesasFixas: [],
  };
}

// ── Dados do mês ──────────────────────────────────────────

function mesKey(mes: string) { return `financas/meses/${mes}.json`; }

export async function getDadosMes(mes: string): Promise<DadosMes> {
  return getBlob<DadosMes>(mesKey(mes), {
    mes,
    lancamentos: [],
    faturas: [],
    despesasFixasGeradas: [],
  });
}

export async function saveDadosMes(dados: DadosMes): Promise<void> {
  await saveBlob(mesKey(dados.mes), dados);
}

// ── Mutex simples para evitar race conditions ─────────────

let saving = false;
const queue: (() => Promise<void>)[] = [];

async function processQueue() {
  if (saving) return;
  saving = true;
  while (queue.length > 0) { const t = queue.shift()!; await t(); }
  saving = false;
}

export function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    queue.push(async () => { try { resolve(await fn()); } catch (e) { reject(e); } });
    processQueue();
  });
}
