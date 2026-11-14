import { useEffect, useState } from 'react';
import {
  Activity, ArrowRight, BrainCircuit, Check, Dumbbell, Flame, MapPin, Minus, PlayCircle,
  ShieldCheck, ShoppingBag, Sparkles, Timer, TrendingUp, Utensils,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { PlayButton } from '../components/ui/Brand';
import { Badge } from '../components/ui/Badge';
import { SITE } from '../config/site';
import { PLANS, TRIAL_DAYS } from '../config/plans';
import { fetchActiveProducts } from '../services/accountService';
import { publicStorageUrl } from '../lib/supabase';
import { formatBRL } from '../lib/format';
import { categoryLabel } from '../lib/validation';

function SectionHeading({ eyebrow, title, children, center }) {
  return (
    <div className={center ? 'mx-auto max-w-2xl text-center' : 'max-w-2xl'}>
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand">{eyebrow}</p>
      <h2 className="display mt-3 text-4xl font-extrabold leading-[0.95] sm:text-5xl">{title}</h2>
      {children ? <p className="mt-4 text-base text-muted sm:text-lg">{children}</p> : null}
    </div>
  );
}

/** Mockup do app (puro CSS): mesociclo ZORYX + corrida. */
function PhoneMock() {
  const done = 7;
  return (
    <div className="relative mx-auto w-full max-w-[330px]">
      <div className="absolute -inset-10 rounded-full bg-brand/25 blur-3xl" aria-hidden="true" />
      <div className="relative rounded-[2.4rem] border border-line-strong bg-[#0c0c0f] p-3 shadow-2xl">
        <div className="rounded-[1.9rem] border border-line bg-ink p-4">
          <div className="mb-4 flex items-center justify-between text-[11px] text-subtle">
            <span>Bom treino, atleta</span>
            <span className="flex items-center gap-1 text-brand"><Flame className="h-3.5 w-3.5" /> 12 dias</span>
          </div>

          <div className="rounded-2xl border border-brand/30 bg-gradient-to-br from-brand/20 via-card to-card p-4">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-brand">
              <BrainCircuit className="h-4 w-4" /> ZORYX AI
            </div>
            <p className="display mt-2 text-2xl font-extrabold leading-none">Mesociclo Hipertrofia</p>
            <p className="mt-1 text-xs text-muted">Fase 2 • cargas ajustadas pelo seu histórico</p>
            <div className="mt-4 grid grid-cols-12 gap-1" aria-label={`${done} de 12 sessões concluídas`}>
              {Array.from({ length: 12 }, (_, i) => (
                <span key={i} className={`h-2 rounded-full ${i < done ? 'bg-brand' : 'bg-line-strong'}`} />
              ))}
            </div>
            <div className="mt-2 flex justify-between text-[11px] text-muted">
              <span>{done}/12 sessões</span>
              <span className="text-fg">Treino B • Costas</span>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-line bg-card p-3">
              <MapPin className="h-4 w-4 text-brand" />
              <p className="display mt-2 text-2xl font-extrabold leading-none">8,42<span className="text-sm text-muted"> km</span></p>
              <p className="text-[11px] text-subtle">Pace 5'12"/km</p>
            </div>
            <div className="rounded-2xl border border-line bg-card p-3">
              <Utensils className="h-4 w-4 text-brand" />
              <p className="display mt-2 text-2xl font-extrabold leading-none">2.140<span className="text-sm text-muted"> kcal</span></p>
              <p className="text-[11px] text-subtle">Meta do dia: 92%</p>
            </div>
          </div>

          <div className="mt-3 rounded-2xl border border-line bg-card p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold">Remada curvada</span>
              <span className="text-brand">4 × 8-10</span>
            </div>
            <div className="mt-2 flex items-end gap-1" aria-hidden="true">
              {[30, 45, 40, 60, 55, 72, 68, 85].map((h, i) => (
                <span key={i} className="flex-1 rounded-sm bg-brand/70" style={{ height: `${h * 0.5}px` }} />
              ))}
            </div>
            <p className="mt-2 text-[11px] text-subtle">Carga +12% nas últimas 4 semanas</p>
          </div>
        </div>
      </div>
    </div>
  );
}

const FEATURES = [
  { icon: BrainCircuit, title: 'ZORYX AI', text: 'Treinadora virtual que monta, acompanha e evolui seu protocolo com base nas suas cargas reais, objetivo e restrições.' },
  { icon: MapPin, title: 'Corrida com GPS', text: 'Telemetria de distância, pace, ritmo e calorias em tempo real, com histórico e rotas de cada corrida.' },
  { icon: Utensils, title: 'Nutrição inteligente', text: 'Plano de macros, registro diário de refeições com base na tabela TACO e análise de prato por foto.' },
  { icon: PlayCircle, title: 'Vídeos demonstrativos', text: 'Biblioteca de exercícios com vídeo em loop e checklist de biomecânica para cada movimento.' },
  { icon: TrendingUp, title: 'Evolução com dados', text: 'Volume total, sessões, ofensiva de dias ativos, pesagens e avaliação corporal num só lugar.' },
  { icon: ShieldCheck, title: 'Privacidade de verdade', text: 'Seus dados de saúde protegidos por regras de acesso no banco e exclusão completa quando você quiser.' },
];

const STEPS = [
  { n: '01', title: 'Anamnese', text: 'Objetivo, frequência semanal, local de treino, histórico e restrições articulares ou clínicas.' },
  { n: '02', title: 'Protocolo de 12 sessões', text: 'A ZORYX gera um mesociclo com divisão, séries, repetições e descanso sob medida.' },
  { n: '03', title: 'Execução registrada', text: 'Cada série com carga e repetições alimenta o histórico — online ou offline.' },
  { n: '04', title: 'Evolução adaptativa', text: 'Ao fechar as 12 sessões, o servidor lê seu desempenho real e monta a próxima fase.' },
];

const PLAN_ROWS = [
  ['Fichas oficiais de treino (academia e casa)', true, true],
  ['Biblioteca de exercícios com vídeo', true, true],
  ['Corrida com GPS e histórico', true, true],
  ['Registro de refeições e metas de macros (TACO)', true, true],
  ['Chat com a ZORYX e análise de prato por foto', true, true],
  ['Protocolo personalizado ZORYX AI (mesociclos de 12 sessões)', false, true],
  ['Evolução automática de fase pela IA ao fim de cada ciclo', false, true],
  ['Troca inteligente de exercícios no protocolo', false, true],
];

function Cell({ ok }) {
  return ok ? (
    <Check className="mx-auto h-5 w-5 text-brand" aria-label="Incluído" />
  ) : (
    <Minus className="mx-auto h-5 w-5 text-line-strong" aria-label="Não incluído" />
  );
}

function StoreTeaser() {
  const [products, setProducts] = useState([]);
  useEffect(() => {
    let active = true;
    fetchActiveProducts(3).then((items) => active && setProducts(items));
    return () => {
      active = false;
    };
  }, []);

  const placeholders = [
    { name: 'Coleção Performance', category: 'vestuario', icon: Activity },
    { name: 'Suplementação MOVE+', category: 'suplementos', icon: Sparkles },
    { name: 'Kit Treino em Casa', category: 'equipamentos', icon: Dumbbell },
  ];

  return (
    <section id="loja" className="scroll-mt-20 border-y border-line bg-card/40 py-20 sm:py-28">
      <div className="container-page">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <SectionHeading eyebrow="Em breve" title={<>Loja Oficial <span className="text-brand">MOVE+</span></>}>
            Vestuário de performance, suplementação e acessórios selecionados pela nossa equipe — integrados ao seu treino.
          </SectionHeading>
          <Badge tone="brand" className="self-start md:self-auto"><ShoppingBag className="h-3.5 w-3.5" /> Lançamento em breve</Badge>
        </div>
        <div className="mt-12 grid gap-4 sm:grid-cols-3">
          {products.length
            ? products.map((p) => {
              const img = publicStorageUrl('store-media', p.image_path);
              return (
                <article key={p.id} className="surface overflow-hidden">
                  <div className="aspect-[4/3] bg-ink">
                    {img ? <img src={img} alt={p.name} loading="lazy" className="h-full w-full object-cover" /> : (
                      <div className="flex h-full items-center justify-center"><ShoppingBag className="h-10 w-10 text-line-strong" /></div>
                    )}
                  </div>
                  <div className="p-5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-brand">{categoryLabel(p.category)}</p>
                    <h3 className="mt-1 font-semibold">{p.name}</h3>
                    <p className="mt-2 display text-2xl font-extrabold">{formatBRL(p.price_cents)}</p>
                  </div>
                </article>
              );
            })
            : placeholders.map(({ name, category, icon: Icon }) => (
              <article key={name} className="surface relative overflow-hidden p-6">
                <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-brand/10 blur-2xl" aria-hidden="true" />
                <Icon className="h-8 w-8 text-brand" aria-hidden="true" />
                <p className="mt-6 text-xs font-semibold uppercase tracking-wider text-subtle">{categoryLabel(category)}</p>
                <h3 className="display mt-1 text-2xl font-extrabold">{name}</h3>
                <p className="mt-2 text-sm text-muted">Disponível em breve para atletas MOVE+.</p>
              </article>
            ))}
        </div>
      </div>
    </section>
  );
}

export default function LandingPage() {
  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="bg-grid absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" aria-hidden="true" />
        <div className="absolute left-1/2 top-0 h-[480px] w-[900px] -translate-x-1/2 rounded-full bg-brand/15 blur-[120px]" aria-hidden="true" />
        <div className="container-page relative grid items-center gap-14 py-16 sm:py-24 lg:grid-cols-[1.15fr_1fr] lg:py-28">
          <div>
            <Badge tone="brand"><Sparkles className="h-3.5 w-3.5" /> Nova ZORYX AI • mesociclos adaptativos</Badge>
            <h1 className="display mt-6 text-[3.4rem] font-extrabold leading-[0.88] sm:text-7xl lg:text-[5.5rem]">
              Treine com <span className="text-brand">inteligência.</span><br />Evolua com dados.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-muted">
              O MOVE+ une uma treinadora de IA que ajusta seu treino a cada ciclo, telemetria GPS de corrida e nutrição
              inteligente — tudo no seu bolso, em português e feito para a sua rotina.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <PlayButton />
              <Button to="/entrar" variant="secondary" size="lg">Entrar na minha conta <ArrowRight className="h-4 w-4" /></Button>
            </div>
            <dl className="mt-10 grid max-w-lg grid-cols-3 gap-4 border-t border-line pt-6">
              {[['12', 'sessões por mesociclo'], ['GPS', 'telemetria em tempo real'], ['TACO', 'base nutricional BR']].map(([v, l]) => (
                <div key={l}>
                  <dt className="sr-only">{l}</dt>
                  <dd className="display text-3xl font-extrabold text-fg">{v}</dd>
                  <dd className="text-xs text-subtle">{l}</dd>
                </div>
              ))}
            </dl>
          </div>
          <PhoneMock />
        </div>
      </section>

      {/* ZORYX */}
      <section id="zoryx" className="scroll-mt-20 border-t border-line py-20 sm:py-28">
        <div className="container-page grid gap-14 lg:grid-cols-[1fr_1.2fr] lg:items-start">
          <div className="lg:sticky lg:top-28">
            <SectionHeading eyebrow="Treinadora ZORYX AI" title={<>Um treino que <span className="text-brand">aprende</span> com você</>}>
              Nada de planilha genérica. A ZORYX monta mesociclos de 12 sessões e, ao final de cada um, analisa suas cargas,
              repetições e frequência reais para decidir a próxima fase — progressão, manutenção ou deload.
            </SectionHeading>
            <div className="mt-8 flex flex-wrap gap-2">
              {['Respeita patologias e restrições', 'Academia ou em casa', 'Decisão no servidor, não no app'].map((t) => (
                <Badge key={t}><Check className="h-3.5 w-3.5 text-brand" /> {t}</Badge>
              ))}
            </div>
          </div>
          <ol className="grid gap-4 sm:grid-cols-2">
            {STEPS.map((s) => (
              <li key={s.n} className="surface group p-6 transition hover:border-brand/40">
                <span className="display text-5xl font-extrabold text-brand/30 transition group-hover:text-brand">{s.n}</span>
                <h3 className="mt-3 text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm text-muted">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* RECURSOS */}
      <section id="recursos" className="scroll-mt-20 border-t border-line bg-card/40 py-20 sm:py-28">
        <div className="container-page">
          <SectionHeading center eyebrow="Ecossistema completo" title="Treino, corrida e nutrição. Conectados.">
            Cada série, quilômetro e refeição conversa com o resto. É assim que o MOVE+ enxerga sua evolução de verdade.
          </SectionHeading>
          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <article key={title} className="surface p-6 transition hover:-translate-y-0.5 hover:border-brand/40">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand/12 text-brand">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className="mt-5 text-lg font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{text}</p>
              </article>
            ))}
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="surface flex flex-col justify-between gap-6 overflow-hidden p-8 sm:flex-row sm:items-center">
              <div>
                <Timer className="h-6 w-6 text-brand" aria-hidden="true" />
                <h3 className="display mt-3 text-3xl font-extrabold">Corrida sem perder nenhum metro</h3>
                <p className="mt-2 text-sm text-muted">Rastreamento em segundo plano, fila offline e sincronização automática quando a conexão voltar.</p>
              </div>
            </div>
            <div className="surface flex flex-col justify-between gap-6 overflow-hidden p-8 sm:flex-row sm:items-center">
              <div>
                <Utensils className="h-6 w-6 text-brand" aria-hidden="true" />
                <h3 className="display mt-3 text-3xl font-extrabold">Macros que fecham com o treino</h3>
                <p className="mt-2 text-sm text-muted">Metas diárias calculadas pelo seu objetivo e peso atual, com alimentos brasileiros de verdade.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PLANOS */}
      <section id="planos" className="scroll-mt-20 border-t border-line py-20 sm:py-28">
        <div className="container-page">
          <SectionHeading center eyebrow="Planos" title={<><span className="text-brand">{TRIAL_DAYS} dias grátis</span> de VIP completo.</>}>
            Todo novo cadastro começa com acesso VIP liberado. Depois, escolha um plano ou continue no gratuito, sem cobrança automática. Sem fidelidade.
          </SectionHeading>

          <div className="mx-auto mt-14 grid max-w-5xl gap-4 md:grid-cols-3">
            <div className="surface flex flex-col p-8">
              <p className="text-sm font-semibold text-muted">Gratuito</p>
              <p className="display mt-2 text-5xl font-extrabold">R$ 0</p>
              <p className="mt-1 text-sm text-subtle">Para começar a se mover hoje.</p>
              <Button href={SITE.playStoreUrl} variant="secondary" className="mt-6 w-full">Baixar grátis</Button>
            </div>
            {PLANS.map((plan) =>
              plan.highlight ? (
                <div key={plan.id} className="relative flex flex-col overflow-hidden rounded-2xl border border-brand/60 bg-gradient-to-b from-brand/15 to-card p-8 shadow-[0_0_60px_-20px_rgba(249,115,22,0.5)]">
                  <Badge tone="brand" className="absolute right-6 top-6">Economize {plan.savingsPercent}%</Badge>
                  <p className="text-sm font-semibold text-brand">VIP {plan.title}</p>
                  <p className="display mt-2 text-5xl font-extrabold">{formatBRL(plan.priceCents)}<span className="text-lg text-muted">/{plan.period}</span></p>
                  <p className="mt-1 text-sm text-subtle">Equivale a <strong className="text-fg">{formatBRL(plan.monthlyEquivalentCents)}/mês</strong>.</p>
                  <Button href={SITE.playStoreUrl} className="mt-6 w-full">Começar {TRIAL_DAYS} dias grátis</Button>
                </div>
              ) : (
                <div key={plan.id} className="surface flex flex-col p-8">
                  <p className="text-sm font-semibold text-muted">VIP {plan.title}</p>
                  <p className="display mt-2 text-5xl font-extrabold">{formatBRL(plan.priceCents)}<span className="text-lg text-muted">/{plan.period}</span></p>
                  <p className="mt-1 text-sm text-subtle">Flexível: cancele quando quiser.</p>
                  <Button href={SITE.playStoreUrl} variant="secondary" className="mt-6 w-full">Começar {TRIAL_DAYS} dias grátis</Button>
                </div>
              ),
            )}
          </div>
          <p className="mx-auto mt-4 max-w-3xl text-center text-xs text-subtle">
            Assinaturas cobradas pela Google Play dentro do app, com renovação automática. Cancele a qualquer momento em Play Store › Pagamentos e assinaturas.
          </p>

          <div className="surface mx-auto mt-6 max-w-4xl overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <caption className="sr-only">Comparativo entre os planos Gratuito e VIP</caption>
              <thead>
                <tr className="border-b border-line text-left">
                  <th scope="col" className="px-5 py-4 font-semibold">Recurso</th>
                  <th scope="col" className="w-28 px-5 py-4 text-center font-semibold text-muted">Gratuito</th>
                  <th scope="col" className="w-28 px-5 py-4 text-center font-semibold text-brand">VIP</th>
                </tr>
              </thead>
              <tbody>
                {PLAN_ROWS.map(([label, free, vip]) => (
                  <tr key={label} className="border-b border-line/60 last:border-0">
                    <th scope="row" className="px-5 py-3.5 text-left font-normal text-muted">{label}</th>
                    <td className="px-5 py-3.5"><Cell ok={free} /></td>
                    <td className="px-5 py-3.5"><Cell ok={vip} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <StoreTeaser />

      {/* CTA FINAL */}
      <section className="py-20 sm:py-28">
        <div className="container-page">
          <div className="relative overflow-hidden rounded-3xl border border-brand/40 bg-gradient-to-br from-brand/25 via-card to-ink p-10 sm:p-16">
            <div className="bg-grid absolute inset-0 opacity-60" aria-hidden="true" />
            <div className="relative max-w-2xl">
              <h2 className="display text-5xl font-extrabold leading-[0.9] sm:text-6xl">Seu próximo treino começa agora.</h2>
              <p className="mt-4 text-lg text-muted">Baixe o MOVE+ e deixe a ZORYX montar seu primeiro mesociclo.</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <PlayButton />
                <Button to="/entrar" variant="secondary" size="lg">Já tenho conta</Button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
