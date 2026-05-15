import { NextRequest, NextResponse } from 'next/server';
import { getDadosMes, saveDadosMes, enqueue } from '@/lib/blob';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { mes, valor, motivo } = await req.json();

  if (!mes || valor === undefined) {
    return NextResponse.json({ error: 'mes e valor são obrigatórios' }, { status: 400 });
  }

  await enqueue(async () => {
    const dados = await getDadosMes(mes);
    dados.reajuste = { valor: Number(valor), motivo: motivo || '' };
    await saveDadosMes(dados);
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { mes } = await req.json();

  await enqueue(async () => {
    const dados = await getDadosMes(mes);
    dados.reajuste = undefined;
    await saveDadosMes(dados);
  });

  return NextResponse.json({ ok: true });
}
