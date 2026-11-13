import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import '@fontsource/barlow-condensed/700.css';
import '@fontsource/barlow-condensed/800.css';
import './index.css';
import { ErrorBoundary, clearReloadFlag, isChunkLoadError, reloadOnceForNewDeploy } from './components/ErrorBoundary';
import { FullScreenLoader } from './components/ui/Spinner';

// import() dinâmico: um erro ao avaliar qualquer módulo da aplicação (config, supabase, rotas)
// vira uma Promise rejeitada que o ErrorBoundary exibe — em vez de impedir o React de montar.
const Root = lazy(() => import('./Root'));

// Chunk antigo após redeploy (o Vite dispara este evento antes do import falhar).
window.addEventListener('vite:preloadError', (event) => {
  if (reloadOnceForNewDeploy()) event.preventDefault();
});

window.addEventListener('unhandledrejection', (event) => {
  if (isChunkLoadError(event.reason)) reloadOnceForNewDeploy();
  console.error('[MOVE+] Promise rejeitada sem tratamento:', event.reason);
});

// Página carregou bem: libera um novo auto-reload no próximo deploy.
window.addEventListener('load', () => setTimeout(clearReloadFlag, 10_000));

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(
    <StrictMode>
      <ErrorBoundary>
        <Suspense fallback={<FullScreenLoader />}>
          <Root />
        </Suspense>
      </ErrorBoundary>
    </StrictMode>,
  );
}
