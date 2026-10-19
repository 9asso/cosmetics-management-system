import { site } from "@/lib/site";
import { WhatsAppIcon } from "./icons";

export function WhatsAppButton() {
  return (
    <a
      className="whatsapp-fab"
      href={site.whatsapp.url}
      target="_blank"
      rel="noreferrer"
      aria-label={`Nous écrire sur WhatsApp (${site.whatsapp.display})`}
    >
      <span className="whatsapp-fab-label" aria-hidden="true">
        <small>Une question ?</small>
        Écrivez-nous sur WhatsApp
      </span>
      <span className="whatsapp-fab-icon">
        <WhatsAppIcon size={30} />
      </span>
    </a>
  );
}
