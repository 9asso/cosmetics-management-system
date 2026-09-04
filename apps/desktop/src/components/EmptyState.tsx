import { ui } from "../lib/ui";
import { CloudOff } from "lucide-react";

export function ErrorState({
  message,
  retry,
}: {
  message: string;
  retry: () => void;
}) {
  return (
    <div className={ui("empty-state")}>
      <span className={ui("empty-icon")}>
        <CloudOff size={22} />
      </span>
      <div>
        <strong>Connexion indisponible</strong>
        <p>{message}</p>
      </div>
      <button className={ui("secondary-button")} type="button" onClick={retry}>
        Réessayer
      </button>
    </div>
  );
}
