import { NextRequest, NextResponse } from 'next/server';
import { getDadosMes, saveDadosMes, getConfig, enqueue } from '@/lib/blob';
import { uid, mesFatura, mesProximo } from '@/lib/financas';
import { Lancamento, Fatura } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const mes = req.nextUrl.searchParams.get('mes') || new Date().toISOString().slice(0, 7);
  const dados = await getDadosMes(mes);
  return NextResponse.json(dados, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const config = await getConfig();

  const result = await enqueue(async () => {
    const mes = body.data.slice(0, 7);
    const dados = await getDadosMes(mes);

    const lancamento: Lancamento = {
      id: uid(),
      tipo: body.tipo,
      descricao: body.descricao,
      valor: Number(body.valor),
      data: body.data,
      categoriaId: body.categoriaId,
      planejamentoId: body.planejamentoId,
      cartaoId: body.cartaoId,
      fixaId: body.fixaId,
      parcela: body.parcela,
      observacao: body.observacao,
    };

    dados.lancamentos.push(lancamento);

    // Se crédito, criar/atualizar fatura no mês de cobrança
    if (body.tipo === 'credito' && body.cartaoId) {
      const cartao = config.cartoes.find(c => c.id === body.cartaoId);
      if (cartao) {
        const mesCobranca = mesFatura(body.data, cartao.diaFechamento);
        const dadosFatura = await getDadosMes(mesCobranca);

        let fatura = dadosFatura.faturas.find(
          f => f.cartaoId === body.cartaoId && f.mesCobranca === mesCobranca
        );

        if (!fatura) {
          fatura = {
            cartaoId: body.cartaoId,
            mes,
            mesCobranca,
            lancamentoIds: [],
            paga: false,
          };
          dadosFatura.faturas.push(fatura);
        }

        fatura.lancamentoIds.push(lancamento.id);
        await saveDadosMes(dadosFatura);
      }
    }

    await saveDadosMes(dados);
    return lancamento;
  });

  return NextResponse.json(result);
}

export async function DELETE(req: NextRequest) {
  const { id, mes } = await req.json();

  await enqueue(async () => {
    const dados = await getDadosMes(mes);
    dados.lancamentos = dados.lancamentos.filter(l => l.id !== id);
    await saveDadosMes(dados);
  });

  return NextResponse.json({ ok: true });
}
