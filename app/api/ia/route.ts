import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getConfig, getDadosMes } from '@/lib/blob';
import { mesAtual, formatarValor } from '@/lib/financas';

export const dynamic = 'force-dynamic';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Registro por texto ────────────────────────────────────

export async function POST(req: NextRequest) {
  const body = await req.json();
  const config = await getConfig();

  if (body.modo === 'texto') {
    const categoriasStr = config.categorias.map(c =>
      `${c.id}: ${c.nome} (${c.tipo})`
    ).join('\n');
    const planejamentosStr = config.planejamentos.filter(p => p.ativo).map(p =>
      `${p.id}: ${p.nome} (${p.percentual}%)`
    ).join('\n');
    const cartoesStr = config.cartoes.filter(c => c.ativo).map(c =>
      `${c.id}: ${c.nome}`
    ).join('\n');

    const hoje = new Date().toISOString().slice(0, 10);

    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: `Você é um assistente financeiro. Analise o texto e extraia um lançamento financeiro.
        
Hoje: ${hoje}

Categorias disponíveis:
${categoriasStr}

Planejamentos disponíveis:
${planejamentosStr}

Cartões disponíveis:
${cartoesStr || 'Nenhum'}

Texto do usuário: "${body.texto}"

Responda APENAS com JSON válido, sem markdown, no formato:
{
  "tipo": "entrada" | "debito" | "credito",
  "descricao": "string",
  "valor": number,
  "data": "YYYY-MM-DD",
  "categoriaId": "string ou null",
  "planejamentoId": "string ou null",
  "cartaoId": "string ou null (só se tipo=credito)",
  "observacao": "string ou null",
  "confianca": "alta" | "media" | "baixa"
}`
      }],
    });

    const texto = msg.content[0].type === 'text' ? msg.content[0].text : '{}';
    try {
      const dados = JSON.parse(texto.replace(/```json|```/g, '').trim());
      return NextResponse.json(dados);
    } catch {
      return NextResponse.json({ error: 'Não consegui interpretar o texto' }, { status: 422 });
    }
  }

  if (body.modo === 'foto') {
    const categoriasStr = config.categorias
      .filter(c => c.tipo === 'despesa')
      .map(c => `${c.id}: ${c.nome}`).join('\n');

    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: body.mimeType, data: body.imagemBase64 },
          },
          {
            type: 'text',
            text: `Analise este cupom fiscal ou nota e extraia as informações.
            
Categorias disponíveis:
${categoriasStr}

Hoje: ${new Date().toISOString().slice(0, 10)}

Responda APENAS com JSON válido:
{
  "tipo": "debito",
  "descricao": "string (nome do estabelecimento)",
  "valor": number (valor total),
  "data": "YYYY-MM-DD",
  "categoriaId": "string ou null",
  "observacao": "string ou null",
  "confianca": "alta" | "media" | "baixa"
}`
          }
        ],
      }],
    });

    const texto = msg.content[0].type === 'text' ? msg.content[0].text : '{}';
    try {
      const dados = JSON.parse(texto.replace(/```json|```/g, '').trim());
      return NextResponse.json(dados);
    } catch {
      return NextResponse.json({ error: 'Não consegui ler o cupom' }, { status: 422 });
    }
  }

  if (body.modo === 'chat') {
    const mes = body.mes || mesAtual();
    const dados = await getDadosMes(mes);

    const resumo = {
      totalEntradas: dados.lancamentos.filter(l => l.tipo === 'entrada').reduce((s, l) => s + l.valor, 0),
      totalDebito: dados.lancamentos.filter(l => l.tipo === 'debito').reduce((s, l) => s + l.valor, 0),
      lancamentos: dados.lancamentos.slice(-20).map(l => ({
        tipo: l.tipo, descricao: l.descricao, valor: l.valor, data: l.data,
        categoria: config.categorias.find(c => c.id === l.categoriaId)?.nome,
        planejamento: config.planejamentos.find(p => p.id === l.planejamentoId)?.nome,
      })),
      planejamentos: config.planejamentos.filter(p => p.ativo),
      categorias: config.categorias,
    };

    const historico = (body.historico || []).map((m: { role: string; content: string }) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      system: `Você é um assistente financeiro pessoal inteligente e amigável. 
Responda em português brasileiro, de forma concisa e útil.
Dados financeiros do mês atual: ${JSON.stringify(resumo)}
Renda mensal configurada: ${formatarValor(config.rendaMensal)}`,
      messages: [
        ...historico,
        { role: 'user', content: body.mensagem },
      ],
    });

    const resposta = msg.content[0].type === 'text' ? msg.content[0].text : '';
    return NextResponse.json({ resposta });
  }

  if (body.modo === 'analise') {
    const mes = body.mes || mesAtual();
    const dados = await getDadosMes(mes);

    const totalEntradas = dados.lancamentos.filter(l => l.tipo === 'entrada').reduce((s, l) => s + l.valor, 0);
    const totalDebito = dados.lancamentos.filter(l => l.tipo === 'debito').reduce((s, l) => s + l.valor, 0);

    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: `Faça uma análise financeira do mês em português brasileiro.
        
Dados: ${JSON.stringify({
  mes,
  totalEntradas,
  totalDebito,
  lancamentos: dados.lancamentos.map(l => ({
    tipo: l.tipo, valor: l.valor,
    categoria: config.categorias.find(c => c.id === l.categoriaId)?.nome,
    planejamento: config.planejamentos.find(p => p.id === l.planejamentoId)?.nome,
  })),
  planejamentos: config.planejamentos.filter(p => p.ativo),
  rendaMensal: config.rendaMensal,
})}

Seja direto, use bullet points, destaque pontos positivos e de atenção. Máximo 300 palavras.`
      }],
    });

    const analise = msg.content[0].type === 'text' ? msg.content[0].text : '';
    return NextResponse.json({ analise });
  }

  return NextResponse.json({ error: 'Modo inválido' }, { status: 400 });
}
