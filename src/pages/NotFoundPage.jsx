import { Button } from '../components/ui/Button';

export default function NotFoundPage() {
  return (
    <div className="container-page flex flex-col items-center py-28 text-center">
      <p className="display text-8xl font-extrabold text-brand">404</p>
      <h1 className="display mt-2 text-4xl font-extrabold">Página não encontrada</h1>
      <p className="mt-3 max-w-md text-muted">O endereço pode ter mudado ou não existe mais.</p>
      <Button to="/" className="mt-8">Voltar para o início</Button>
    </div>
  );
}
