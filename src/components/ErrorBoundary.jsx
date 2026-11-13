import { Component } from 'react';

const RELOAD_FLAG = 'moveplus:chunk-reload';

/** Depois de um redeploy, abas antigas pedem chunks com hash que não existe mais. */
export function isChunkLoadError(error) {
  const msg = String(error?.message || error || '');
  return /dynamically imported module|importing a module script failed|failed to fetch dynamically|error loading dynamically|ChunkLoadError|Unable to preload CSS/i.test(msg);
}

/** Recarrega uma única vez por sessão para buscar o index.html novo. Devolve true se recarregou. */
export function reloadOnceForNewDeploy() {
  try {
    if (sessionStorage.getItem(RELOAD_FLAG)) return false;
    sessionStorage.setItem(RELOAD_FLAG, String(Date.now()));
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}

export function clearReloadFlag() {
  try {
    sessionStorage.removeItem(RELOAD_FLAG);
  } catch {
    /* storage indisponível: sem problema */
  }
}

/**
 * Barreira global de erros de renderização. Qualquer falha de runtime vira uma tela legível,
 * com o detalhe técnico recolhido — nunca uma tela preta silenciosa.
 */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null, copied: false };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[MOVE+] Erro de renderização capturado:', error, info?.componentStack);
    this.setState({ info });
    if (isChunkLoadError(error)) reloadOnceForNewDeploy();
  }

  copyDetails = async () => {
    try {
      await navigator.clipboard.writeText(this.details());
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    } catch {
      /* sem clipboard: o texto continua selecionável */
    }
  };

  details() {
    const { error, info } = this.state;
    return [
      `Erro: ${error?.name || 'Error'}: ${error?.message || String(error)}`,
      `Página: ${window.location.href}`,
      `Quando: ${new Date().toISOString()}`,
      `Navegador: ${navigator.userAgent}`,
      '',
      error?.stack || '',
      info?.componentStack ? `\nComponentes:${info.componentStack}` : '',
    ].join('\n').trim();
  }

  render() {
    const { error, copied } = this.state;
    if (!error) return this.props.children;
    const chunk = isChunkLoadError(error);

    return (
      <div className="flex min-h-dvh items-center justify-center bg-ink px-4 py-10 text-fg" role="alert">
        <div className="w-full max-w-xl">
          <div className="mb-6 flex items-center gap-3">
            <img src="/brand/logo-move-plus.png" alt="MOVE+" width="60" height="44" className="h-11 w-auto" />
            <span className="display text-2xl font-extrabold leading-none tracking-tight">MOVE<span className="text-brand">+</span></span>
          </div>
          <div className="surface p-6 shadow-2xl sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-wider text-brand">{chunk ? 'Nova versão disponível' : 'Algo saiu do esperado'}</p>
            <h1 className="display mt-2 text-4xl font-extrabold leading-none">
              {chunk ? 'Atualizando o MOVE+' : 'Não conseguimos exibir esta página'}
            </h1>
            <p className="mt-3 text-sm text-muted">
              {chunk
                ? 'Publicamos uma versão nova do site. Recarregue a página para continuar.'
                : 'Ocorreu um erro inesperado. Recarregue a página; se continuar, envie os detalhes abaixo para o suporte.'}
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              <button type="button" onClick={() => { clearReloadFlag(); window.location.reload(); }}
                className="inline-flex h-11 items-center rounded-xl bg-brand px-5 text-sm font-semibold text-black transition hover:brightness-110">
                Recarregar página
              </button>
              <a href="/" className="inline-flex h-11 items-center rounded-xl border border-line-strong px-5 text-sm font-semibold transition hover:border-brand/60">
                Ir para o início
              </a>
            </div>

            <details className="mt-6 rounded-xl border border-line bg-black/40">
              <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-muted hover:text-fg">Detalhes técnicos</summary>
              <div className="border-t border-line px-4 py-3">
                <p className="break-words font-mono text-xs text-red-300">{error?.name || 'Error'}: {error?.message || String(error)}</p>
                <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-subtle">{this.details()}</pre>
                <button type="button" onClick={this.copyDetails} className="mt-3 text-xs font-semibold text-brand hover:underline">
                  {copied ? 'Copiado!' : 'Copiar detalhes'}
                </button>
              </div>
            </details>
          </div>
        </div>
      </div>
    );
  }
}
