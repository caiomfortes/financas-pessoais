# 💰 App de Finanças Pessoais

Gestão financeira pessoal com IA, PWA, gráficos e categorias.

## Stack

- **Next.js 15** (App Router)
- **Vercel Blob** (armazenamento de dados)
- **Anthropic Haiku** (IA para lançamentos e chat)
- **Recharts** (gráficos)
- **PWA** (installável no celular)

## Funcionalidades

- ✅ Login com senha única (cookie 30 dias)
- ✅ Dashboard com score, saldo, gráficos e análise IA
- ✅ Lançamentos por texto natural, foto de cupom ou formulário
- ✅ Chat financeiro com IA
- ✅ Cartões de crédito com controle de fatura
- ✅ Planejamentos por % (ex: 50/20/30)
- ✅ Relatórios com projeções e heatmap de gastos
- ✅ Configurações: categorias, cartões, fixas, exportar XLSX
- ✅ PWA instalável no Android e iPhone

## Deploy na Vercel

### 1. Criar repositório
```bash
git init
git add .
git commit -m "first commit"
gh repo create financas --private --push --source=.
```

### 2. Importar na Vercel
- Acesse vercel.com/new
- Importe o repositório `financas`
- Framework Preset: **Next.js**

### 3. Criar Blob Store
- No painel do projeto → Storage → Create → Blob
- Nome: `financas-data`
- A variável `BLOB_READ_WRITE_TOKEN` é adicionada automaticamente

### 4. Variáveis de ambiente (Settings → Environment Variables)
```
APP_PASSWORD=sua_senha_aqui
ANTHROPIC_API_KEY=sk-ant-XXXXXXXX
NEXT_PUBLIC_SITE_URL=https://seu-app.vercel.app
```

### 5. Redeploy
Após adicionar as variáveis, clique em **Redeploy**.

## Como instalar como PWA

**Android (Chrome):**
1. Abra o site no Chrome
2. Menu (⋮) → "Adicionar à tela inicial"

**iPhone (Safari):**
1. Abra o site no Safari
2. Botão de compartilhar (□↑) → "Adicionar à Tela de Início"

## Custo estimado

| Serviço | Custo |
|---------|-------|
| Vercel (Hobby) | Gratuito |
| Vercel Blob | Gratuito (até 1GB) |
| Anthropic API (Haiku) | ~R$1–3/mês |
