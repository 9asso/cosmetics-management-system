"use client";

import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { Check, ChevronDown } from "lucide-react";

export type SelectOption<T extends string> = { value: T; label: string };

/** A select whose options open in a panel right under the field. */
export function SelectMenu<T extends string>({
  value,
  options,
  onChange,
  label,
  icon,
  className = "",
}: {
  value: T;
  options: readonly SelectOption<T>[];
  onChange: (value: T) => void;
  label: string;
  icon?: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const id = useId();
  const selected = Math.max(0, options.findIndex((option) => option.value === value));

  useEffect(() => {
    if (!open) return;
    list.current?.focus();
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);

  const show = () => {
    setActive(selected);
    setOpen(true);
  };
  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) trigger.current?.focus();
  };
  const choose = (index: number) => {
    const option = options[index];
    if (option && option.value !== value) onChange(option.value);
    close();
  };

  const onTriggerKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      show();
    }
  };
  const onListKey = (event: KeyboardEvent<HTMLUListElement>) => {
    const last = options.length - 1;
    const moves: Record<string, number> = {
      ArrowDown: Math.min(last, active + 1),
      ArrowUp: Math.max(0, active - 1),
      Home: 0,
      End: last,
    };
    if (event.key in moves) {
      event.preventDefault();
      setActive(moves[event.key]!);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      choose(active);
    } else if (event.key === "Escape") {
      // Keep the store's global Escape handler from also closing an overlay.
      event.preventDefault();
      event.stopPropagation();
      close();
    } else if (event.key === "Tab") {
      close(false);
    }
  };

  return (
    <div ref={root} className={`select ${open ? "is-open" : ""} ${className}`}>
      <button
        ref={trigger}
        type="button"
        className="select-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-label={`${label} : ${options[selected]?.label ?? ""}`}
        onClick={() => (open ? close() : show())}
        onKeyDown={onTriggerKey}
      >
        {icon}
        <span>{options[selected]?.label}</span>
        <ChevronDown size={16} className="select-chevron" />
      </button>
      <ul
        ref={list}
        id={`${id}-list`}
        className="select-menu"
        role="listbox"
        tabIndex={-1}
        aria-label={label}
        aria-activedescendant={open ? `${id}-${active}` : undefined}
        onKeyDown={onListKey}
      >
        {options.map((option, index) => (
          <li
            key={option.value}
            id={`${id}-${index}`}
            role="option"
            aria-selected={index === selected}
            className={index === active ? "is-active" : ""}
            style={{ "--i": index } as CSSProperties}
            onPointerEnter={() => setActive(index)}
            onClick={() => choose(index)}
          >
            {option.label}
            {index === selected && <Check size={16} />}
          </li>
        ))}
      </ul>
    </div>
  );
}
