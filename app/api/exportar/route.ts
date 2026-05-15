import { NextRequest, NextResponse } from 'next/server';
import { getDadosMes, getConfig } from '@/lib/blob';
import * as XLSX from 'xlsx';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const de = req.nextUrl.searchParams.get('de') || new Date().toISOString().slice(0, 7);
  const ate = req.nextUrl.searchParams.get('ate') || de;

  const config = await getConfig();

  // Gera lista de meses entre de e ate
  const meses: string[] = [];
  let cur = de;
  while (cur <= ate) {
    meses.push(cur);
    const [y, m] = cur.split('-').map(Number);
    const next = new Date(y, m, 1);
    cur = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
  }

  const linhas: Record<string, string | number>[] = [];

  for (const mes of meses) {
    const dados = await getDadosMes(mes);
    for (const l of dados.lancamentos) {
      if (l.tipo === 'credito') continue; // não exporta crédito
      const cat = config.categorias.find(c => c.id === l.categoriaId);
      const plan = config.planejamentos.find(p => p.id === l.planejamentoId);
      linhas.push({
        'Mês': mes,
        'Data': l.data,
        'Tipo': l.tipo === 'entrada' ? 'Entrada' : 'Saída (Débito)',
        'Descrição': l.descricao,
        'Valor': l.valor,
        'Categoria': cat?.nome ?? '',
        'Planejamento': plan?.nome ?? '',
        'Observação': l.observacao ?? '',
      });
    }
  }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(linhas);
  XLSX.utils.book_append_sheet(wb, ws, 'Lançamentos');

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="financas-${de}-${ate}.xlsx"`,
    },
  });
}
