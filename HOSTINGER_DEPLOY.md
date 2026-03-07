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

## 3. Solução Robusta (Nova Abordagem)

Se mesmo configurando a variável de ambiente a IA não funcionar (erro "Chave Inválida" ou "Modelo Indisponível"), implementamos uma **solução manual**:

1.  Abra o aplicativo publicado.
2.  Vá em **Configurações > Conexões API**.
3.  Insira sua Chave de API (Gemini) no campo "Chave de API Personalizada".
4.  Clique em Salvar.

O aplicativo passará a usar essa chave salva no seu navegador, ignorando qualquer configuração de servidor que possa estar falhando.

## 4. Modelos de IA

O sistema agora tenta automaticamente os seguintes modelos, nesta ordem, para garantir disponibilidade:
1.  `gemini-1.5-flash` (Padrão, mais estável)
2.  `gemini-2.0-flash-exp` (Experimental, mais inteligente)
3.  `gemini-1.5-flash-latest` (Fallback)

---
**Resumo da Correção Aplicada:**
1.  **Fallback de Modelos:** O sistema agora tenta 3 modelos diferentes antes de falhar.
2.  **Chave Manual:** Adicionada opção em "Configurações" para inserir a chave manualmente se a variável de ambiente falhar.
3.  **Logs de Debug:** Adicionados logs no console (F12) para identificar se a chave está sendo carregada corretamente.
