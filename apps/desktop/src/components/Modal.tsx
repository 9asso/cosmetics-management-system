import { ui } from "../lib/ui";
import { X } from "lucide-react";
import { useId, type ReactNode } from "react";

export function Modal({
  title,
  subtitle,
  onClose,
  children,
  size = "default",
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  size?: "default" | "wide";
}) {
  const titleId = useId();
  return (
    <div
      className={ui("modal-backdrop")}
      role="presentation"
      onMouseDown={onClose}
    >
      <section
        className={ui("modal", size === "wide" && "max-w-[980px]")}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className={ui("modal-header")}>
          <div>
            <h2 id={titleId}>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button
            className={ui("icon-button")}
            type="button"
            onClick={onClose}
            aria-label="Fermer"
          >
            <X size={19} />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
