import { ui } from "../lib/ui";
import type { ReactNode } from "react";

export function StatusPill({
  tone,
  children,
}: {
  tone: "good" | "warn" | "bad" | "neutral";
  children: ReactNode;
}) {
  return <span className={ui(`status-pill status-${tone}`)}>{children}</span>;
}
