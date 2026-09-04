import { CloudOff } from 'lucide-react';

export function ErrorState({ message, retry }: { message: string; retry: () => void }) {
  return (
    <div className="empty-state">
      <span className="empty-icon"><CloudOff size={22} /></span>
      <div>
        <strong>Connexion indisponible</strong>
        <p>{message}</p>
      </div>
      <button className="secondary-button" type="button" onClick={retry}>Réessayer</button>
    </div>
  );
}
