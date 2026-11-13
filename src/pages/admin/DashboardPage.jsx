import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Activity, ArrowRight, Crown, Dumbbell, MapPin, RefreshCw, UserPlus, UserX, Users } from 'lucide-react';
import { PageHeader } from './AdminLayout';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/Alert';
import { InlineLoader } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/ui/Brand';
import { fetchDashboard } from '../../services/adminService';
import { formatNumber, formatRelative } from '../../lib/format';

const REFRESH_MS = 30_000;

function Kpi({ icon: Icon, label, value, hint, tone = 'default', to }) {
  const body = (
    <div className={`surface h-full p-5 transition ${to ? 'hover:border-brand/50' : ''} ${tone === 'alert' ? 'border-warn/40 bg-warn/5' : ''}`}>
      <div className="flex items-center justify-between">
        <span className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${tone === 'alert' ? 'bg-warn/15 text-amber-400' : 'bg-brand/12 text-brand'}`}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        {to ? <ArrowRight className="h-4 w-4 text-subtle" aria-hidden="true" /> : null}
      </div>
      <p className="display mt-4 text-4xl font-extrabold leading-none">{value}</p>
      <p className="mt-1 text-sm font-medium">{label}</p>
      {hint ? <p className="mt-0.5 text-xs text-subtle">{hint}</p> : null}
    </div>
  );
  return to ? <Link to={to} className="block">{body}</Link> : body;
}

export default function DashboardPage() {
  const [state, setState] = useState({ loading: true, error: '', data: null, updatedAt: null });
  const timer = useRef(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchDashboard();
      setState({ loading: false, error: '', data, updatedAt: new Date() });
    } catch (err) {
      setState((s) => ({ ...s, loading: false, error: err.message }));
    }
  }, []);

  useEffect(() => {
    load();
    const tick = () => {
      if (document.visibilityState === 'visible') load();
    };
    timer.current = setInterval(tick, REFRESH_MS);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(timer.current);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [load]);

  const s = state.data?.stats || {};
  const pending = state.data?.pendingDeletions;

  return (
    <>
      <PageHeader
        title="Dashboard executivo"
        description={state.updatedAt ? `Atualizado ${formatRelative(state.updatedAt)} • atualização automática a cada 30 s` : 'Métricas reais da plataforma (sem dados de sandbox).'}
        actions={<Button variant="secondary" size="sm" onClick={load}><RefreshCw className="h-4 w-4" /> Atualizar</Button>}
      />

      {state.error ? <Alert tone="error" className="mb-6">{state.error}</Alert> : null}
      {state.loading ? <InlineLoader label="Carregando KPIs…" /> : state.data ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi icon={Users} label="Total de usuários" value={formatNumber(s.users_total ?? 0)} hint={`+${formatNumber(s.users_new_7d ?? 0)} nos últimos 7 dias`} to="/admin/usuarios" />
            <Kpi icon={Crown} label="Assinantes VIP" value={formatNumber(s.vip_total ?? 0)}
              hint={s.users_total ? `${((100 * (s.vip_total ?? 0)) / s.users_total).toFixed(1)}% da base` : undefined} />
            <Kpi icon={Dumbbell} label="Treinos concluídos" value={formatNumber(s.workout_sessions ?? 0)} hint={`${formatNumber(s.workout_sets ?? 0)} séries registradas`} />
            <Kpi icon={UserX} label="Exclusões pendentes" value={pending === null ? '—' : formatNumber(pending)}
              hint={state.data.pendingDeletionsError || 'Prazo LGPD: 30 dias'} tone={pending > 0 ? 'alert' : 'default'} to="/admin/exclusoes" />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4 xl:grid-cols-4">
            {[
              [Activity, 'Ativos (7 dias)', s.active_athletes_7d],
              [Activity, 'Ativos (30 dias)', s.mau],
              [UserPlus, 'Novos (30 dias)', s.users_new_30d],
              [MapPin, 'Km corridos', s.runs_km],
            ].map(([Icon, label, value]) => (
              <div key={label} className="surface flex items-center gap-3 p-4">
                <Icon className="h-4 w-4 shrink-0 text-subtle" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="font-semibold">{formatNumber(value ?? 0)}</p>
                  <p className="truncate text-xs text-subtle">{label}</p>
                </div>
              </div>
            ))}
          </div>

          <section className="surface mt-6 p-6" aria-labelledby="recentes">
            <div className="flex items-center justify-between">
              <h2 id="recentes" className="text-lg font-semibold">Treinos mais recentes</h2>
              <span className="text-xs text-subtle">Últimas sessões de toda a base</span>
            </div>
            {state.data.recentWorkouts.length ? (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-subtle">
                      <th className="py-2.5 pr-4 font-semibold">Atleta</th>
                      <th className="py-2.5 pr-4 font-semibold">Quando</th>
                      <th className="py-2.5 pr-4 text-right font-semibold">Séries</th>
                      <th className="py-2.5 pr-4 text-right font-semibold">Exercícios</th>
                      <th className="py-2.5 text-right font-semibold">Volume</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.data.recentWorkouts.map((w) => (
                      <tr key={w.key} className="border-b border-line/60 last:border-0">
                        <td className="py-3 pr-4 font-medium">{w.full_name || 'Atleta'}</td>
                        <td className="py-3 pr-4 text-muted">{formatRelative(w.last_at)}</td>
                        <td className="py-3 pr-4 text-right">{w.sets}</td>
                        <td className="py-3 pr-4 text-right">{w.exercises}</td>
                        <td className="py-3 text-right font-semibold">{formatNumber(w.volume_kg)} kg</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="mt-4"><EmptyState icon={Dumbbell} title="Nenhum treino nos últimos 120 dias" /></div>
            )}
          </section>
        </>
      ) : null}
    </>
  );
}
