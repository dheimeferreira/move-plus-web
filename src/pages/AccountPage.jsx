import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import {
  Activity, BrainCircuit, Crown, Dumbbell, Flame, LogOut, MapPin, Scale, Shield, ShoppingBag, Target, Trash2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Logo, EmptyState, PlayButton } from '../components/ui/Brand';
import { Button } from '../components/ui/Button';
import { Badge, RoleBadge } from '../components/ui/Badge';
import { InlineLoader } from '../components/ui/Spinner';
import { fetchActivePlan, fetchActiveProducts, fetchOwnStats, fetchRecentSessions } from '../services/accountService';
import { formatBRL, formatDate, formatDateTime, formatNumber, initials } from '../lib/format';
import { publicStorageUrl } from '../lib/supabase';
import { categoryLabel } from '../lib/validation';
import { SITE, VIP_ROLES } from '../config/site';

const GOAL_LABEL = { emagrecimento: 'Emagrecimento', hipertrofia: 'Hipertrofia', definicao: 'Definição', condicionamento: 'Condicionamento' };

/** Ofensiva: dias consecutivos com atividade até hoje (ou ontem). Mesma ideia de src/utils/profileStats.js do app. */
function streakFrom(stats) {
  const dates = new Set(stats?.active_dates || []);
  if (!dates.size || !stats?.today) return 0;
  const day = new Date(`${stats.today}T12:00:00Z`);
  const iso = (d) => d.toISOString().slice(0, 10);
  if (!dates.has(iso(day))) day.setUTCDate(day.getUTCDate() - 1);
  let count = 0;
  while (dates.has(iso(day))) {
    count += 1;
    day.setUTCDate(day.getUTCDate() - 1);
  }
  return count;
}

function Stat({ icon: Icon, label, value, suffix }) {
  return (
    <div className="surface p-5">
      <Icon className="h-5 w-5 text-brand" aria-hidden="true" />
      <p className="display mt-3 text-3xl font-extrabold leading-none">
        {value}{suffix ? <span className="ml-1 text-base text-muted">{suffix}</span> : null}
      </p>
      <p className="mt-1 text-xs text-subtle">{label}</p>
    </div>
  );
}

export default function AccountPage() {
  const { user, profile, role, signOut } = useAuth();
  const [data, setData] = useState({ loading: true, stats: null, plan: null, sessions: [], products: [] });

  useEffect(() => {
    if (!user) return undefined;
    let active = true;
    Promise.all([fetchOwnStats(), fetchActivePlan(user.id), fetchRecentSessions(user.id), fetchActiveProducts(4)]).then(
      ([stats, plan, sessions, products]) => active && setData({ loading: false, stats, plan, sessions, products }),
    );
    return () => {
      active = false;
    };
  }, [user]);

  const name = profile?.full_name || user?.email?.split('@')[0] || 'Atleta';
  const isVip = VIP_ROLES.includes(role);
  const { stats } = data;

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-line bg-ink/85 backdrop-blur-xl">
        <div className="container-page flex h-16 items-center justify-between gap-3">
          <Logo />
          <div className="flex items-center gap-2">
            {role === 'admin' ? <Button to="/admin" variant="secondary" size="sm"><Shield className="h-4 w-4" /> <span className="hidden sm:inline">Painel admin</span></Button> : null}
            <Button variant="ghost" size="sm" onClick={signOut}><LogOut className="h-4 w-4" /> <span className="hidden sm:inline">Sair</span></Button>
          </div>
        </div>
      </header>

      <main className="container-page py-10">
        {/* Perfil */}
        <section className="surface relative overflow-hidden p-6 sm:p-8">
          <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-brand/15 blur-3xl" aria-hidden="true" />
          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              {profile?.avatar_url && /^https:\/\//.test(profile.avatar_url) ? (
                <img src={profile.avatar_url} alt="" className="h-16 w-16 rounded-2xl border border-line object-cover" />
              ) : (
                <span className="display flex h-16 w-16 items-center justify-center rounded-2xl border border-brand/40 bg-brand/10 text-2xl font-extrabold text-brand">
                  {initials(name)}
                </span>
              )}
              <div className="min-w-0">
                <p className="text-sm text-muted">Olá,</p>
                <h1 className="display truncate text-4xl font-extrabold leading-none">{name}</h1>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <RoleBadge role={role} />
                  {profile?.goal ? <Badge><Target className="h-3 w-3" /> {GOAL_LABEL[profile.goal] || profile.goal}</Badge> : null}
                  {profile?.created_at ? <span className="text-xs text-subtle">Atleta desde {formatDate(profile.created_at)}</span> : null}
                </div>
              </div>
            </div>
            <div className={`rounded-2xl border p-4 sm:w-72 ${isVip ? 'border-brand/50 bg-brand/10' : 'border-line bg-ink'}`}>
              <div className="flex items-center gap-2">
                <Crown className={`h-5 w-5 ${isVip ? 'text-brand' : 'text-subtle'}`} aria-hidden="true" />
                <p className="font-semibold">{isVip ? 'Plano VIP ativo' : 'Plano Gratuito'}</p>
              </div>
              <p className="mt-1 text-xs text-muted">
                {isVip ? 'Acesso completo à ZORYX AI e aos protocolos adaptativos.' : `Desbloqueie a ZORYX AI completa por ${SITE.vipPrice}/mês no app.`}
              </p>
            </div>
          </div>

          {profile ? (
            <dl className="relative mt-6 grid grid-cols-2 gap-4 border-t border-line pt-6 text-sm sm:grid-cols-4">
              <div><dt className="text-subtle">Peso atual</dt><dd className="font-semibold">{profile.current_weight ? `${formatNumber(profile.current_weight)} kg` : '—'}</dd></div>
              <div><dt className="text-subtle">Peso-alvo</dt><dd className="font-semibold">{profile.target_weight ? `${formatNumber(profile.target_weight)} kg` : '—'}</dd></div>
              <div><dt className="text-subtle">Altura</dt><dd className="font-semibold">{profile.height ? `${formatNumber(profile.height)} cm` : '—'}</dd></div>
              <div><dt className="text-subtle">Frequência</dt><dd className="font-semibold">{profile.weekly_frequency ? `${profile.weekly_frequency}x por semana` : '—'}</dd></div>
            </dl>
          ) : null}
        </section>

        {/* Estatísticas */}
        <section aria-labelledby="stats" className="mt-8">
          <h2 id="stats" className="display text-2xl font-extrabold">Seu desempenho</h2>
          {data.loading ? <InlineLoader /> : (
            <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-5">
              <Stat icon={Dumbbell} label="Sessões de treino" value={formatNumber(stats?.workout_sessions ?? 0)} />
              <Stat icon={Scale} label="Volume levantado" value={formatNumber(Math.round(stats?.volume_kg ?? 0))} suffix="kg" />
              <Stat icon={MapPin} label="Distância corrida" value={formatNumber(stats?.runs_km ?? profile?.total_km ?? 0)} suffix="km" />
              <Stat icon={Activity} label="Corridas" value={formatNumber(stats?.runs_count ?? 0)} />
              <Stat icon={Flame} label="Ofensiva de dias" value={formatNumber(streakFrom(stats))} />
            </div>
          )}
        </section>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          {/* Histórico */}
          <section aria-labelledby="historico" className="surface p-6">
            <h2 id="historico" className="text-lg font-semibold">Histórico recente de treinos</h2>
            {data.loading ? <InlineLoader /> : data.sessions.length ? (
              <ul className="mt-4 divide-y divide-line">
                {data.sessions.map((s) => (
                  <li key={s.key} className="flex items-center justify-between gap-4 py-3.5">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{s.exercises.slice(0, 3).join(' • ') || 'Treino'}{s.exercises.length > 3 ? ` +${s.exercises.length - 3}` : ''}</p>
                      <p className="text-xs text-subtle">{formatDateTime(s.lastAt)} • {s.sets} séries</p>
                    </div>
                    <p className="shrink-0 text-right text-sm"><span className="font-semibold">{formatNumber(s.volume)}</span> <span className="text-subtle">kg</span></p>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-4"><EmptyState icon={Dumbbell} title="Nenhum treino registrado ainda">Registre suas séries pelo app e elas aparecem aqui.</EmptyState></div>
            )}
          </section>

          {/* Protocolo ZORYX */}
          <section aria-labelledby="zoryx" className="surface flex flex-col p-6">
            <h2 id="zoryx" className="flex items-center gap-2 text-lg font-semibold"><BrainCircuit className="h-5 w-5 text-brand" /> Protocolo ZORYX</h2>
            {data.loading ? <InlineLoader /> : data.plan ? (
              <div className="mt-4 rounded-2xl border border-brand/30 bg-brand/5 p-5">
                <p className="display text-2xl font-extrabold leading-tight">{data.plan.title}</p>
                <p className="mt-1 text-sm text-muted">{data.plan.level} • {data.plan.weekly_frequency}x/semana • {data.plan.location}</p>
                <p className="mt-3 text-xs text-subtle">Gerado em {formatDate(data.plan.created_at)}. Acompanhe o mesociclo de 12 sessões no app.</p>
              </div>
            ) : (
              <div className="mt-4 flex-1">
                <EmptyState icon={BrainCircuit} title="Sem protocolo ativo">
                  {isVip ? 'Gere seu mesociclo personalizado na aba Treino do app.' : 'O protocolo adaptativo da ZORYX faz parte do plano VIP.'}
                </EmptyState>
              </div>
            )}
            <div className="mt-6"><PlayButton className="w-full justify-center" /></div>
          </section>
        </div>

        {/* Loja */}
        <section aria-labelledby="loja" className="mt-8">
          <div className="flex items-end justify-between gap-4">
            <h2 id="loja" className="display text-2xl font-extrabold">Loja MOVE+</h2>
            <Badge tone="brand">Em breve</Badge>
          </div>
          {data.loading ? <InlineLoader /> : data.products.length ? (
            <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
              {data.products.map((p) => {
                const img = publicStorageUrl('store-media', p.image_path);
                return (
                  <article key={p.id} className="surface overflow-hidden">
                    <div className="aspect-square bg-ink">
                      {img ? <img src={img} alt={p.name} loading="lazy" className="h-full w-full object-cover" /> : (
                        <div className="flex h-full items-center justify-center"><ShoppingBag className="h-8 w-8 text-line-strong" /></div>
                      )}
                    </div>
                    <div className="p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-brand">{categoryLabel(p.category)}</p>
                      <h3 className="mt-0.5 line-clamp-2 text-sm font-semibold">{p.name}</h3>
                      <p className="mt-2 font-semibold">{formatBRL(p.price_cents)}</p>
                      <p className="mt-0.5 text-xs text-subtle">{p.stock > 0 ? 'Disponível no lançamento' : 'Esgotado'}</p>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="mt-4"><EmptyState icon={ShoppingBag} title="A vitrine abre em breve">Vestuário, suplementos e acessórios oficiais MOVE+.</EmptyState></div>
          )}
        </section>

        <footer className="mt-12 flex flex-col gap-3 border-t border-line pt-6 text-sm text-subtle sm:flex-row sm:items-center sm:justify-between">
          <p>Conectado como {user?.email}</p>
          <div className="flex gap-4">
            <Link to="/privacidade" className="hover:text-fg">Privacidade</Link>
            <Link to="/excluir-conta" className="flex items-center gap-1 hover:text-red-400"><Trash2 className="h-3.5 w-3.5" /> Excluir conta</Link>
          </div>
        </footer>
      </main>
    </div>
  );
}
