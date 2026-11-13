# MOVE+ Web

Site público, Área do Aluno e Painel Master Admin do ecossistema **MOVE+**.
React 19 + Vite 8 + Tailwind CSS 4 + React Router 7 + Supabase (mesmo projeto do app mobile `../move-plus`).

## Rotas

| Rota | Acesso | O que é |
|---|---|---|
| `/` | público | Landing page comercial (ZORYX AI, GPS, nutrição, planos, loja em breve) |
| `/privacidade` | público | Política de Privacidade (LGPD + Google Play) |
| `/excluir-conta` | público | Exclusão de conta exigida pelo Google Play + formulário (RPC com rate limit) |
| `/entrar`, `/redefinir-senha` | público | Login com a mesma conta do app e recuperação de senha |
| `/minha-conta` | logado | Perfil, plano, estatísticas, histórico de treinos, protocolo ZORYX, vitrine da loja |
| `/admin/*` | **admin** | Dashboard, usuários & equipe, exercícios, loja, exclusões LGPD |

## Configuração

```bash
cp .env.example .env   # preencha VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY e VITE_CONTACT_EMAIL
npm install
npm run dev
```

> Só a chave **anon/publishable** vai para o navegador. Nunca use a `service_role` aqui.

## Banco de dados (obrigatório antes do deploy)

Rode no Supabase › SQL Editor, **depois** das migrações do app mobile (`../move-plus/supabase/sql`, em especial
`2026-11-08_admin_lockdown`, `2026-11-10_profile_security_stats` e `2026-11-11_admin_hub`):

```
supabase-web-migrations/2026-11-12_web_platform.sql
```

O arquivo é idempotente e aborta sozinho se algum pré-requisito faltar. Ele cria:

- `profiles.role` com `user | vip | personal | nutricionista | admin` (CHECK), sem autopromoção;
- `professionals` (CREF/CRN), escrita só via RPC `admin_upsert_professional` / `admin_remove_professional` (auditadas);
- `store_products` + bucket `store-media` (leitura pública só de itens ativos, escrita só do admin);
- `account_deletion_requests` + RPC pública `request_account_deletion` (validação, HMAC de IP, rate limit).

## Modelo de segurança

- **Quem decide é o banco.** `public.is_admin()` (role `admin` + conta do proprietário em `auth.users`) protege todas as
  policies e é a primeira linha de cada RPC `admin_*`. O guard de rota (`RequireAdmin`) confere `profiles.role === 'admin'`
  **e** `rpc('is_admin') === true`; se alguém burlar a tela no navegador, o banco continua recusando tudo.
- Cargo nunca é alterado pelo próprio usuário (trigger `protect_profile_columns`); `admin` não pode ser concedido pelo painel.
- O e-mail do proprietário **não** está no bundle do site.
- Busca com curingas do `ILIKE` escapados; uploads validados pelos bytes do arquivo (não pela extensão).
- Formulário de exclusão: honeypot + tempo mínimo + rate limit no servidor; resposta genérica (não revela se o e-mail existe).
- `vercel.json` aplica CSP restrita, HSTS, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy` e `Permissions-Policy`.

## Deploy na Vercel

1. Importe o repositório na Vercel (framework detectado: Vite).
2. Em *Settings › Environment Variables*, defina `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` e `VITE_CONTACT_EMAIL`.
3. No Supabase › Authentication › URL Configuration, adicione o domínio do site em **Site URL / Redirect URLs**
   (inclua `https://SEU-DOMINIO/redefinir-senha` para a recuperação de senha).
4. O `vercel.json` já faz o rewrite SPA (`/(.*) → /index.html`): todas as rotas abrem direto, sem 404.

URL para o Google Play Console › Segurança dos dados › Exclusão de conta: `https://SEU-DOMINIO/excluir-conta`.
Política de Privacidade: `https://SEU-DOMINIO/privacidade`.
