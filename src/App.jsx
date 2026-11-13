import { lazy, Suspense, useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router';
import { PublicLayout } from './components/layout/PublicLayout';
import { RequireAdmin, RequireAuth } from './components/RouteGuards';
import { FullScreenLoader } from './components/ui/Spinner';
import LandingPage from './pages/LandingPage';
import PrivacyPage from './pages/PrivacyPage';
import DeleteAccountPage from './pages/DeleteAccountPage';
import LoginPage from './pages/LoginPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import NotFoundPage from './pages/NotFoundPage';

// Áreas logadas em chunks separados: o site público carrega mais rápido.
const AccountPage = lazy(() => import('./pages/AccountPage'));
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'));
const AdminDashboard = lazy(() => import('./pages/admin/DashboardPage'));
const AdminUsers = lazy(() => import('./pages/admin/UsersPage'));
const AdminExercises = lazy(() => import('./pages/admin/ExercisesPage'));
const AdminStore = lazy(() => import('./pages/admin/StorePage'));
const AdminDeletions = lazy(() => import('./pages/admin/DeletionRequestsPage'));

const TITLES = {
  '/': 'MOVE+ | Treino com IA, corrida com GPS e nutrição inteligente',
  '/privacidade': 'Política de Privacidade | MOVE+',
  '/excluir-conta': 'Excluir conta e dados | MOVE+',
  '/entrar': 'Entrar | MOVE+',
  '/redefinir-senha': 'Redefinir senha | MOVE+',
  '/minha-conta': 'Minha conta | MOVE+',
};

function DocumentTitle() {
  const { pathname } = useLocation();
  useEffect(() => {
    document.title = TITLES[pathname] || (pathname.startsWith('/admin') ? 'Painel Master | MOVE+' : 'MOVE+');
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <>
      <DocumentTitle />
      <Suspense fallback={<FullScreenLoader />}>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route index element={<LandingPage />} />
            <Route path="privacidade" element={<PrivacyPage />} />
            <Route path="excluir-conta" element={<DeleteAccountPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
          <Route path="entrar" element={<LoginPage />} />
          <Route path="redefinir-senha" element={<ResetPasswordPage />} />
          <Route path="minha-conta" element={<RequireAuth><AccountPage /></RequireAuth>} />
          <Route path="admin" element={<RequireAdmin><AdminLayout /></RequireAdmin>}>
            <Route index element={<AdminDashboard />} />
            <Route path="usuarios" element={<AdminUsers />} />
            <Route path="exercicios" element={<AdminExercises />} />
            <Route path="loja" element={<AdminStore />} />
            <Route path="exclusoes" element={<AdminDeletions />} />
          </Route>
        </Routes>
      </Suspense>
    </>
  );
}
