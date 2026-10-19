"use client";

import type { CSSProperties, ReactNode } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useRail } from "./motion";

export function Rail({
  children,
  className = "",
  label,
  dark = false,
}: {
  children: ReactNode;
  className?: string;
  label: string;
  dark?: boolean;
}) {
  const rail = useRail<HTMLDivElement>();
  return (
    <div className={`rail ${dark ? "rail-dark" : ""} ${className}`}>
      <div className="rail-track" ref={rail.ref} role="region" aria-label={label}>
        {children}
      </div>
      <div className="rail-footer">
        <div className="rail-progress" aria-hidden="true">
          <i style={{ "--ratio": rail.ratio, "--progress": rail.progress } as CSSProperties} />
        </div>
        <div className="rail-arrows">
          <button type="button" className="round-button" disabled={rail.atStart} onClick={() => rail.scrollBy(-1)} aria-label="Précédent">
            <ArrowLeft size={18} />
          </button>
          <button type="button" className="round-button" disabled={rail.atEnd} onClick={() => rail.scrollBy(1)} aria-label="Suivant">
            <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
