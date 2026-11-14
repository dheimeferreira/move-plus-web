// Dados públicos do site. Revise antes de publicar (Google Play exige contato real do responsável).
export const SITE = Object.freeze({
  name: 'MOVE+',
  appName: 'MOVE+ Treinos e Corrida',
  androidPackage: 'com.movepluss.app',
  playStoreUrl: 'https://play.google.com/store/apps/details?id=com.movepluss.app',
  contactEmail: import.meta.env.VITE_CONTACT_EMAIL || '',
  deletionDeadlineDays: 30,
  policyUpdatedAt: '12 de novembro de 2026',
});

export const ROLE_LABEL = Object.freeze({
  user: 'Gratuito',
  vip: 'VIP',
  personal: 'Personal Trainer',
  nutricionista: 'Nutricionista',
  admin: 'Admin',
});

/** Cargos com acesso VIP no app (mesma regra de supabase/functions/_shared/trainingCycle.js). */
export const VIP_ROLES = Object.freeze(['vip', 'admin']);
