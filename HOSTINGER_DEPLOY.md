# Guia de Deploy na Hostinger (Next.js + Gemini AI)

Para garantir que o **CVFacil.NG** funcione corretamente na Hostinger (especialmente a integração com IA), siga estes passos:

## 1. Configuração de Build (Já realizada)

O projeto foi configurado para **Exportação Estática** (`output: 'export'`). Isso garante compatibilidade com todos os planos da Hostinger (Shared, Cloud, VPS).
- O comando de build (`npm run build`) irá gerar uma pasta `out/` com os arquivos HTML/CSS/JS.
- As imagens foram configuradas como `unoptimized: true` para funcionar sem servidor Node.js.

## 2. Variáveis de Ambiente (CRÍTICO)

O erro mais comum é a falta da Chave de API da Google Gemini no ambiente de produção. Como o aplicativo é estático, a chave precisa ser "embutida" durante o build.

### No Painel da Hostinger (ou GitHub Actions):

1.  Acesse as configurações de **Deploy** ou **Environment Variables**.
2.  Adicione a seguinte variável:
    *   **Nome:** `NEXT_PUBLIC_GEMINI_API_KEY`
    *   **Valor:** `Sua_Chave_API_Aqui` (começa com `AIza...`)

> **Nota:** Se você usar apenas `API_KEY`, o Next.js pode não expor a variável para o navegador. Use `NEXT_PUBLIC_GEMINI_API_KEY` para garantir.

## 3. Configuração do Repositório (GitHub)

Certifique-se de que o Hostinger está configurado para publicar a pasta de saída correta.
- **Diretório de Publicação (Publish Directory):** `out`
- **Comando de Build:** `npm run build`

## 4. Solução de Problemas Comuns

*   **Erro 404 na IA:** Verifique se a chave API está correta e se o modelo `gemini-2.5-flash-latest` está disponível para sua conta.
*   **Imagens quebradas:** Certifique-se de que as imagens estão na pasta `public/` e referenciadas com `/` no início (ex: `/logo.png`).
*   **Página em Branco:** Verifique o console do navegador (F12) para erros de JavaScript. Geralmente indica falta de configuração de ambiente.

---
**Resumo da Correção Aplicada:**
1.  Alterado `next.config.mjs` para `output: 'export'` (compatibilidade total).
2.  Atualizado modelo de IA para `gemini-2.5-flash-latest` (mais estável).
3.  Adicionado este guia.
