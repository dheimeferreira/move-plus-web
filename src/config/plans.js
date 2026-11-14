// Planos oficiais do MOVE+ (espelho de move-plus/src/services/billing/plans.ts).
// Ao mudar preço: altere aqui, no app, na migração 2026-11-13_vip_trial_billing.sql e na Play Console.
// A cobrança é sempre pela Google Play, dentro do app; o site só apresenta os planos.

export const TRIAL_DAYS = 7;

const MONTHLY_CENTS = 2990;
const YEARLY_CENTS = 19990;

export const PLANS = Object.freeze([
  Object.freeze({
    id: 'moveplus_vip_yearly',
    title: 'Anual',
    period: 'ano',
    priceCents: YEARLY_CENTS,
    monthlyEquivalentCents: Math.floor(YEARLY_CENTS / 12), // R$ 16,65
    savingsPercent: Math.floor((1 - YEARLY_CENTS / (MONTHLY_CENTS * 12)) * 100), // 44
    highlight: true,
  }),
  Object.freeze({
    id: 'moveplus_vip_monthly',
    title: 'Mensal',
    period: 'mês',
    priceCents: MONTHLY_CENTS,
    monthlyEquivalentCents: MONTHLY_CENTS,
    savingsPercent: 0,
    highlight: false,
  }),
]);

/** Rótulo do plano a partir da RPC my_entitlement (ou do role, sem a migração). */
export function entitlementLabel(entitlement, role) {
  if (entitlement?.source === 'trial') {
    const d = Math.max(0, Number(entitlement.trial_days_left) || 0);
    return `Teste VIP grátis · ${d} ${d === 1 ? 'dia restante' : 'dias restantes'}`;
  }
  if (entitlement?.is_vip) return 'Plano VIP ativo';
  if (!entitlement && ['vip', 'admin'].includes(role)) return 'Plano VIP ativo';
  return 'Plano Gratuito';
}
