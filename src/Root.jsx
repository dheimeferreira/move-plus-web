import { BrowserRouter } from 'react-router';
import { AuthProvider } from './context/AuthContext';
import App from './App';

/** Árvore da aplicação. Carregada por import() em main.jsx para que qualquer falha aqui caia no ErrorBoundary. */
export default function Root() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  );
}
