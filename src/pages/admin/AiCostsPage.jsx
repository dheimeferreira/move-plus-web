import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bot, Coins, DollarSign, RefreshCw, Sparkles, TrendingUp, Users } from 'lucide-react';
import { PageHeader } from './AdminLayout';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/Alert';
import { InlineLoader } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/ui/Brand';
import { AI_COST_PERIODS, fetchAiCosts } from '../../services/adminService';
import { formatNumber, formatRelative } from '../../lib/format';
import { ROLE_LABEL } from '../../config/site';

const RATE_KEY = 'moveplus:usd-brl-rate';
const DEFAULT_RATE = 5.8;
const RATE_MIN = 0.5;
const RATE_MAX = 50;

const FEATURE_LABEL = {
  'chat-zoryx': 'Chat ZORYX',
  'generate-custom-workout': 'Treino Personalizado',
  'ask-zoryx': 'Pergunte à ZORYX',
  'analyze-food-image': 'Análise de refeição (foto)',
  'transcribe-audio': 'Transcrição de áudio',
};
const featureLabel = (key) => FEATURE_LABEL[key] || key;

function readRate() {
  try {
    const n = Number(localStorage.getItem(RATE_KEY));
    return Number.isFinite(n) && n >= RATE_MIN && n <= RATE_MAX ? n : DEFAULT_RATE;
  } catch {
    return DEFAULT_RATE;
  }
}

function saveRate(value) {
  try {
    localStorage.setItem(RATE_KEY, String(value));
  } catch {
    /* modo privado: vale só nesta visita */
  }
}

/** Custos de IA são frações de centavo: mais casas decimais quando o valor é pequeno. */
function money(value, currency) {
  const n = Number(value) || 0;
  const digits = n === 0 ? 2 : Math.abs(n) < 0.01 ? 5 : Math.abs(n) < 1 ? 4 : 2;
  return new Intl.NumberFormat(currency === 'BRL' ? 'pt-BR' : 'en-US', {
    style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: digits,
  }).format(n);
}

function Kpi({ icon: Icon, label, brl, usd, hint }) {
  return (
    <div className="surface h-full p-5">
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand/12 text-brand">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <p className="display mt-4 text-3xl font-extrabold leading-none sm:text-4xl">{brl}</p>
      {usd ? <p className="mt-1 font-mono text-xs text-subtle">{usd}</p> : null}
      <p className="mt-2 text-sm font-medium">{label}</p>
      {hint ? <p className="mt-0.5 text-xs text-subtle">{hint}</p> : null}
    </div>
  );
}

function RateField({ rate, onChange }) {
  const [draft, setDraft] = useState(() => rate.toFixed(2).replace('.', ','));
  const [invalid, setInvalid] = useState(false);

  useEffect(() => setDraft(rate.toFixed(2).replace('.', ',')), [rate]);

  function commit(text) {
    const n = Number(String(text).replace(/\s|R\$/g, '').replace(',', '.'));
    if (!Number.isFinite(n) || n < RATE_MIN || n > RATE_MAX) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    onChange(Math.round(n * 10000) / 10000);
  }

  return (
    <div className="surface flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/12 text-emerald-400">
          <DollarSign className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <label htmlFor="usd-rate" className="text-sm font-semibold">Cotação do Dólar (R$)</label>
          <p className="text-xs text-subtle">A OpenAI cobra em USD. Valor salvo neste navegador; padrão R$ 5,80.</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className={`flex h-11 items-center rounded-xl border bg-black/30 px-3 ${invalid ? 'border-red-500/70' : 'border-line-strong focus-within:border-brand'}`}>
          <span className="text-sm text-subtle">US$ 1 =&nbsp;R$</span>
          <input id="usd-rate" inputMode="decimal" autoComplete="off" maxLength={8}
            className="w-20 bg-transparent pl-1 text-right font-semibold outline-none"
            value={draft}
            onChange={(e) => { setDraft(e.target.value); setInvalid(false); }}
            onBlur={(e) => commit(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') commit(e.currentTarget.value); }}
            aria-invalid={invalid} aria-describedby={invalid ? 'usd-rate-err' : undefined} />
        </div>
        <Button variant="ghost" size="sm" onClick={() => onChange(DEFAULT_RATE)}>Padrão</Button>
      </div>
      {invalid ? <p id="usd-rate-err" className="text-xs text-red-400 sm:basis-full">Informe um valor entre R$ {RATE_MIN.toFixed(2).replace('.', ',')} e R$ {RATE_MAX.toFixed(2).replace('.', ',')}.</p> : null}
    </div>
  );
}

export default function AiCostsPage() {
  const [period, setPeriod] = useState('30');
  const [rate, setRate] = useState(readRate);
  const [state, setState] = useState({ loading: true, error: '', data: null, updatedAt: null });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: !s.data, error: '' }));
    try {
      const data = await fetchAiCosts({ period });
      setState({ loading: false, error: '', data, updatedAt: new Date() });
    } catch (err) {
      setState((s) => ({ ...s, loading: false, error: err.message }));
    }
  }, [period]);

  useEffect(() => {
    load();
  }, [load]);

  const changeRate = useCallback((value) => {
    setRate(value);
    saveRate(value);
  }, []);

  const brl = useCallback((usd) => money((Number(usd) || 0) * rate, 'BRL'), [rate]);
  const usd = (value) => money(value, 'USD');

  const t = state.data?.totals || {};
  const totalCost = Number(t.cost_usd) || 0;
  const periodLabel = AI_COST_PERIODS.find((p) => p.key === period)?.label || '';

  const features = useMemo(() => (state.data?.byFeature || []).map((f) => ({
    ...f,
    share: totalCost > 0 ? (100 * Number(f.cost_usd)) / totalCost : 0,
  })), [state.data, totalCost]);

  return (
    <>
      <PageHeader
        title="Custos IA"
        description={state.updatedAt ? `Gasto real com a OpenAI • atualizado ${formatRelative(state.updatedAt)}` : 'Gasto real com a OpenAI, por funcionalidade e por aluno.'}
        actions={(
          <>
            <div className="flex rounded-xl border border-line bg-card p-1" role="group" aria-label="Período">
              {AI_COST_PERIODS.map((p) => (
                <button key={p.key} type="button" onClick={() => setPeriod(p.key)} aria-pressed={period === p.key}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${period === p.key ? 'bg-brand text-black' : 'text-muted hover:text-fg'}`}>
                  {p.label}
                </button>
              ))}
            </div>
            <Button variant="secondary" size="sm" onClick={load}><RefreshCw className="h-4 w-4" /> Atualizar</Button>
          </>
        )}
      />

      <RateField rate={rate} onChange={changeRate} />

      {state.error ? <Alert tone="error" className="mt-6">{state.error}</Alert> : null}
      {state.loading ? <InlineLoader label="Calculando custos…" /> : state.data ? (
        <>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi icon={Coins} label={`Gasto total (${periodLabel})`} brl={brl(totalCost)} usd={usd(totalCost)}
              hint={`Histórico completo: ${brl(state.data.allTime.cost_usd)}`} />
            <Kpi icon={Users} label="Custo médio por aluno" brl={brl(t.avg_cost_per_user)} usd={usd(t.avg_cost_per_user)}
              hint={`${formatNumber(t.users ?? 0)} ${Number(t.users) === 1 ? 'aluno usou' : 'alunos usaram'} a IA`} />
            <Kpi icon={TrendingUp} label="Custo médio por chamada" brl={brl(t.avg_cost_per_call)} usd={usd(t.avg_cost_per_call)}
              hint={`${formatNumber(t.calls ?? 0)} chamadas à OpenAI`} />
            <Kpi icon={Sparkles} label="Tokens processados" brl={formatNumber((Number(t.prompt_tokens) || 0) + (Number(t.completion_tokens) || 0))}
              hint={`${formatNumber(t.prompt_tokens ?? 0)} entrada • ${formatNumber(t.completion_tokens ?? 0)} saída`} />
          </div>

          <section className="surface mt-6 p-6" aria-labelledby="por-funcionalidade">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="por-funcionalidade" className="text-lg font-semibold">Detalhamento por funcionalidade</h2>
              {state.data.byModel.length ? (
                <span className="text-xs text-subtle">Modelos: {state.data.byModel.map((m) => m.model).join(', ')}</span>
              ) : null}
            </div>
            {features.length ? (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-subtle">
                      <th className="py-2.5 pr-4 font-semibold">Funcionalidade</th>
                      <th className="py-2.5 pr-4 text-right font-semibold">Chamadas</th>
                      <th className="py-2.5 pr-4 text-right font-semibold">Alunos</th>
                      <th className="py-2.5 pr-4 text-right font-semibold">Tokens</th>
                      <th className="py-2.5 pr-4 text-right font-semibold">Custo médio</th>
                      <th className="py-2.5 pr-4 text-right font-semibold">Total</th>
                      <th className="py-2.5 text-right font-semibold">% do gasto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {features.map((f) => (
                      <tr key={f.feature} className="border-b border-line/60 last:border-0">
                        <td className="py-3 pr-4">
                          <p className="font-medium">{featureLabel(f.feature)}</p>
                          <p className="font-mono text-[11px] text-subtle">{f.feature}</p>
                        </td>
                        <td className="py-3 pr-4 text-right">{formatNumber(f.calls)}</td>
                        <td className="py-3 pr-4 text-right">{formatNumber(f.users)}</td>
                        <td className="py-3 pr-4 text-right text-muted">{formatNumber((Number(f.prompt_tokens) || 0) + (Number(f.completion_tokens) || 0))}</td>
                        <td className="py-3 pr-4 text-right text-muted">{brl(Number(f.calls) ? Number(f.cost_usd) / Number(f.calls) : 0)}</td>
                        <td className="py-3 pr-4 text-right">
                          <p className="font-semibold">{brl(f.cost_usd)}</p>
                          <p className="font-mono text-[11px] text-subtle">{usd(f.cost_usd)}</p>
                        </td>
                        <td className="py-3 text-right font-semibold tabular-nums">{f.share.toFixed(1).replace('.', ',')}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="mt-4"><EmptyState icon={Bot} title="Nenhuma chamada à IA neste período">
                Os registros aparecem assim que as Edge Functions atualizadas forem publicadas.
              </EmptyState></div>
            )}
          </section>

          <section className="surface mt-6 p-6" aria-labelledby="ranking-alunos">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="ranking-alunos" className="text-lg font-semibold">Ranking de gasto por aluno</h2>
              <span className="text-xs text-subtle">Top {state.data.topUsers.length || 0} • {periodLabel}</span>
            </div>
            {state.data.topUsers.length ? (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[680px] text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-subtle">
                      <th className="py-2.5 pr-4 font-semibold">#</th>
                      <th className="py-2.5 pr-4 font-semibold">Aluno</th>
                      <th className="py-2.5 pr-4 font-semibold">Uso principal</th>
                      <th className="py-2.5 pr-4 text-right font-semibold">Chamadas</th>
                      <th className="py-2.5 pr-4 font-semibold">Último uso</th>
                      <th className="py-2.5 text-right font-semibold">Gasto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.data.topUsers.map((u, i) => {
                      const main = Object.entries(u.features || {}).sort((a, b) => Number(b[1]) - Number(a[1]))[0];
                      return (
                        <tr key={u.user_id} className="border-b border-line/60 last:border-0">
                          <td className="py-3 pr-4 font-mono text-xs text-subtle">{i + 1}</td>
                          <td className="py-3 pr-4">
                            <p className="font-medium">
                              {u.full_name || 'Atleta sem nome'}
                              {u.role && u.role !== 'user' ? (
                                <span className="ml-2 rounded-md border border-brand/40 bg-brand/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand">{ROLE_LABEL[u.role] || u.role}</span>
                              ) : null}
                            </p>
                            <p className="truncate text-xs text-subtle">{u.email || '—'}</p>
                          </td>
                          <td className="py-3 pr-4 text-muted">{main ? featureLabel(main[0]) : '—'}</td>
                          <td className="py-3 pr-4 text-right">{formatNumber(u.calls)}</td>
                          <td className="py-3 pr-4 text-muted">{formatRelative(u.last_at)}</td>
                          <td className="py-3 text-right">
                            <p className="font-semibold">{brl(u.cost_usd)}</p>
                            <p className="font-mono text-[11px] text-subtle">{usd(u.cost_usd)}</p>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="mt-4"><EmptyState icon={Users} title="Nenhum aluno com gasto de IA neste período" /></div>
            )}
          </section>

          <p className="mt-4 text-xs text-subtle">
            Custos estimados a partir do <code className="font-mono">usage</code> devolvido pela OpenAI e da tabela de preços em
            {' '}<code className="font-mono">supabase/functions/_shared/aiUsage.js</code>. A fatura oficial da OpenAI é a referência final.
          </p>
        </>
      ) : null}
    </>
  );
}
