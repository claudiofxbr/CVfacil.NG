import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Carrega variáveis de ambiente baseadas no modo atual
  const env = loadEnv(mode, (process as any).cwd(), '');

  return {
    plugins: [react()],
    // 'base: ./' garante que os assets sejam carregados com caminhos relativos.
    // Isso é essencial para o GitHub Pages (ex: https://user.github.io/repo/)
    base: './', 
    define: {
      // Injeta a variável process.env.API_KEY no código compilado de forma segura
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
    },
    build: {
      // GitHub Actions e Pages geralmente esperam 'dist' como padrão.
      outDir: 'dist', 
      emptyOutDir: true,
      // Otimização para evitar warnings em builds grandes
      chunkSizeWarningLimit: 1600,
      rollupOptions: {
        output: {
          // Garante nomes de arquivos compatíveis com cache agressivo
          entryFileNames: 'assets/[name]-[hash].js',
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash].[ext]'
        }
      }
    }
  };
});