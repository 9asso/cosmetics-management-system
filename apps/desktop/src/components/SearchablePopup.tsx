import { ChevronDown, Search } from "lucide-react";
import { useId, useMemo, useState } from "react";

export function SearchablePopup<T>({
  label,
  placeholder,
  items,
  value,
  onChange,
  getId,
  getLabel,
  getDetail,
  getImage,
  disabled = false,
  query,
  onQueryChange,
  emptyLabel = "Aucun résultat.",
}: {
  label: string;
  placeholder: string;
  items: T[];
  value: string;
  onChange: (id: string) => void;
  getId: (item: T) => string;
  getLabel: (item: T) => string;
  getDetail?: (item: T) => string;
  getImage?: (item: T) => string;
  disabled?: boolean;
  query?: string;
  onQueryChange?: (query: string) => void;
  emptyLabel?: string;
}) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [localQuery, setLocalQuery] = useState("");
  const activeQuery = query ?? localQuery;
  const selected = items.find((item) => getId(item) === value);
  const visibleItems = useMemo(() => {
    if (onQueryChange) return items;
    const normalized = activeQuery.trim().toLocaleLowerCase("fr");
    if (!normalized) return items;
    return items.filter((item) =>
      `${getLabel(item)} ${getDetail?.(item) ?? ""}`
        .toLocaleLowerCase("fr")
        .includes(normalized),
    );
  }, [activeQuery, getDetail, getLabel, items, onQueryChange]);
  const inputValue = open
    ? activeQuery
    : selected
      ? getLabel(selected)
      : activeQuery;
  const updateQuery = (next: string) => {
    if (onQueryChange) onQueryChange(next);
    else setLocalQuery(next);
  };

  return (
    <label
      className="relative block"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <span>{label}</span>
      <span className="relative block">
        <Search
          size={15}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
        />
        <input
          aria-label={label}
          aria-controls={listId}
          aria-expanded={open}
          aria-autocomplete="list"
          role="combobox"
          autoComplete="off"
          disabled={disabled}
          className="pl-9! pr-9!"
          placeholder={placeholder}
          value={inputValue}
          onFocus={(event) => {
            setOpen(true);
            event.currentTarget.select();
          }}
          onChange={(event) => {
            updateQuery(event.target.value);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") setOpen(false);
            if (event.key === "Enter") event.preventDefault();
          }}
        />
        <ChevronDown
          size={16}
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted"
        />
      </span>
      {open && !disabled && (
        <span
          id={listId}
          role="listbox"
          className="absolute z-40 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-line bg-white p-1 shadow-xl dark:bg-[#282428]"
        >
          {visibleItems.map((item) => {
            const id = getId(item);
            const image = getImage?.(item);
            return (
              <button
                key={id}
                type="button"
                role="option"
                aria-selected={id === value}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-brand-soft"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  if (!onQueryChange) updateQuery("");
                  onChange(id);
                  setOpen(false);
                }}
              >
                {getImage && (
                  <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-surface text-[9px] text-muted">
                    {image ? (
                      <img
                        src={image}
                        alt=""
                        className="size-full object-cover"
                      />
                    ) : (
                      "Photo"
                    )}
                  </span>
                )}
                <span className="min-w-0">
                  <strong className="block truncate text-xs">
                    {getLabel(item)}
                  </strong>
                  {getDetail && (
                    <small className="block truncate text-[10px] text-muted">
                      {getDetail(item)}
                    </small>
                  )}
                </span>
              </button>
            );
          })}
          {visibleItems.length === 0 && (
            <small className="block px-3 py-5 text-center text-muted">
              {emptyLabel}
            </small>
          )}
        </span>
      )}
    </label>
  );
}
