import { useState } from "react";
import { CalendarClock, ChevronLeft, ChevronRight } from "lucide-react";

function calendarCursor(from: string, to: string) {
  const month = new Date(`${from.slice(0, 8)}01T12:00:00Z`);
  if (from.slice(0, 7) === to.slice(0, 7)) {
    month.setUTCMonth(month.getUTCMonth() - 1);
  }
  return month.toISOString().slice(0, 10);
}

function ReportCalendarMonth({
  month,
  dateFrom,
  dateTo,
  today,
  onSelect,
  previous,
  next,
}: {
  month: string;
  dateFrom: string;
  dateTo: string;
  today: string;
  onSelect: (day: string) => void;
  previous?: () => void;
  next?: () => void;
}) {
  const firstDay = new Date(`${month.slice(0, 8)}01T12:00:00Z`);
  const year = firstDay.getUTCFullYear();
  const monthIndex = firstDay.getUTCMonth();
  const days = new Date(Date.UTC(year, monthIndex + 1, 0, 12)).getUTCDate();
  const leading = firstDay.getUTCDay();
  const cells = Array.from({ length: leading + days }, (_, index) => {
    if (index < leading) return null;
    const day = new Date(Date.UTC(year, monthIndex, index - leading + 1, 12));
    return day.toISOString().slice(0, 10);
  });
  const monthLabel = firstDay.toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  return (
    <section className="rounded-xl border border-line bg-surface p-3">
      <header className="mb-3 grid grid-cols-[32px_1fr_32px] items-center">
        {previous ? (
          <button
            type="button"
            aria-label="Mois précédents"
            className="grid size-8 place-items-center rounded-lg border border-line bg-white text-ink transition hover:border-brand hover:text-brand dark:bg-[#302b2f]"
            onClick={previous}
          >
            <ChevronLeft size={16} />
          </button>
        ) : (
          <span />
        )}
        <strong className="text-center text-xs capitalize">{monthLabel}</strong>
        {next ? (
          <button
            type="button"
            aria-label="Mois suivants"
            className="grid size-8 place-items-center rounded-lg border border-line bg-white text-ink transition hover:border-brand hover:text-brand dark:bg-[#302b2f]"
            onClick={next}
          >
            <ChevronRight size={16} />
          </button>
        ) : (
          <span />
        )}
      </header>
      <div className="grid grid-cols-7 text-center text-[9px] font-bold text-muted">
        {["D", "L", "M", "M", "J", "V", "S"].map((day, index) => (
          <span key={`${day}-${index}`} className="py-1">
            {day}
          </span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-y-1 text-center">
        {cells.map((day, index) =>
          day ? (
            <button
              key={day}
              type="button"
              aria-label={new Date(`${day}T12:00:00Z`).toLocaleDateString(
                "fr-FR",
                { dateStyle: "long", timeZone: "UTC" },
              )}
              disabled={day > today}
              onClick={() => onSelect(day)}
              className={`mx-auto grid size-8 place-items-center rounded-lg text-[10px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-25 ${
                day === dateFrom || day === dateTo
                  ? "bg-brand text-white shadow-sm"
                  : day > dateFrom && day < dateTo
                    ? "bg-brand-soft text-brand"
                    : day === today
                      ? "ring-1 ring-brand/50 text-brand"
                      : "text-ink hover:bg-brand-soft hover:text-brand"
              }`}
            >
              {Number(day.slice(-2))}
            </button>
          ) : (
            <span key={`empty-${index}`} className="size-8" />
          ),
        )}
      </div>
    </section>
  );
}

export function ReportPeriodPicker({
  dateFrom,
  dateTo,
  today,
  onChange,
}: {
  dateFrom: string;
  dateTo: string;
  today: string;
  onChange: (from: string, to: string) => void;
}) {
  const [choosingEnd, setChoosingEnd] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() =>
    calendarCursor(dateFrom, dateTo),
  );
  const selectedDays =
    Math.max(
      0,
      Math.round(
        (Date.parse(`${dateTo}T12:00:00Z`) -
          Date.parse(`${dateFrom}T12:00:00Z`)) /
          86_400_000,
      ),
    ) + 1;
  const dateAtOffset = (days: number) => {
    const start = new Date(`${today}T12:00:00Z`);
    start.setUTCDate(start.getUTCDate() + days);
    return start.toISOString().slice(0, 10);
  };
  const selectRange = (from: string, to: string) => {
    onChange(from, to);
    setCalendarMonth(calendarCursor(from, to));
    setChoosingEnd(false);
  };
  const weekStart = (value: string) => {
    const date = new Date(`${value}T12:00:00Z`);
    const weekday = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() - weekday + 1);
    return date.toISOString().slice(0, 10);
  };
  const thisWeek = weekStart(today);
  const lastWeekFrom = (() => {
    const date = new Date(`${thisWeek}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() - 7);
    return date.toISOString().slice(0, 10);
  })();
  const lastMonth = (() => {
    const end = new Date(`${today.slice(0, 8)}01T12:00:00Z`);
    end.setUTCDate(0);
    const start = new Date(end);
    start.setUTCDate(1);
    return [start.toISOString().slice(0, 10), end.toISOString().slice(0, 10)];
  })();
  const presets: Array<[string, string, string]> = [
    ["Aujourd’hui", today, today],
    ["Hier", dateAtOffset(-1), dateAtOffset(-1)],
    ["Cette semaine", thisWeek, today],
    [
      "Semaine dernière",
      lastWeekFrom,
      dateAtOffset(-(new Date(`${today}T12:00:00Z`).getUTCDay() || 7)),
    ],
    ["7 derniers jours", dateAtOffset(-6), today],
    ["14 derniers jours", dateAtOffset(-13), today],
    ["Ce mois", `${today.slice(0, 8)}01`, today],
    ["30 derniers jours", dateAtOffset(-29), today],
    ["Mois dernier", lastMonth[0]!, lastMonth[1]!],
    ["Cette année", `${today.slice(0, 4)}-01-01`, today],
  ];
  const changeCalendarMonth = (offset: number) => {
    setCalendarMonth((current) => {
      const date = new Date(`${current}T12:00:00Z`);
      date.setUTCMonth(date.getUTCMonth() + offset);
      return date.toISOString().slice(0, 10);
    });
  };
  const secondCalendarMonth = (() => {
    const date = new Date(`${calendarMonth}T12:00:00Z`);
    date.setUTCMonth(date.getUTCMonth() + 1);
    return date.toISOString().slice(0, 10);
  })();
  const selectCalendarDay = (day: string) => {
    if (!choosingEnd) {
      onChange(day, day);
      setChoosingEnd(true);
      return;
    }
    selectRange(
      day < dateFrom ? day : dateFrom,
      day < dateFrom ? dateFrom : day,
    );
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm dark:bg-[#282428]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3.5">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-brand-soft text-brand">
            <CalendarClock size={19} />
          </span>
          <div>
            <strong className="block text-sm">Période du rapport</strong>
            <small className="text-[10px] text-muted">
              {selectedDays} jour{selectedDays > 1 ? "s" : ""} sélectionné
              {selectedDays > 1 ? "s" : ""}
            </small>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-muted">
          <span
            className={`size-2 rounded-full ${choosingEnd ? "animate-pulse bg-brand" : "bg-emerald-500"}`}
          />
          {choosingEnd ? "Choisissez la date de fin" : "Période prête"}
        </div>
      </div>
      <div className="grid gap-4 p-4 xl:grid-cols-[310px_1fr]">
        <div className="space-y-4">
          <div className="grid items-end gap-2 sm:grid-cols-[1fr_auto_1fr]">
            <label className="block">
              <span className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-muted">
                Date de début
              </span>
              <input
                aria-label="Date de début"
                className="w-full rounded-xl border border-brand/45 bg-white px-3 py-2.5 text-xs font-semibold text-ink outline-none transition focus:border-brand focus:ring-3 focus:ring-brand-soft dark:bg-[#302b2f]"
                type="date"
                value={dateFrom}
                max={dateTo}
                onChange={(event) => selectRange(event.target.value, dateTo)}
              />
            </label>
            <span className="hidden pb-3 text-[10px] font-bold text-muted sm:block">
              au
            </span>
            <label className="block">
              <span className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-muted">
                Date de fin
              </span>
              <input
                aria-label="Date de fin"
                className="w-full rounded-xl border border-brand/45 bg-white px-3 py-2.5 text-xs font-semibold text-ink outline-none transition focus:border-brand focus:ring-3 focus:ring-brand-soft dark:bg-[#302b2f]"
                type="date"
                value={dateTo}
                min={dateFrom}
                max={today}
                onChange={(event) => selectRange(dateFrom, event.target.value)}
              />
            </label>
          </div>
          <div className="grid grid-cols-2 content-start gap-1.5">
            {presets.map(([label, from, to]) => {
              const active = dateFrom === from && dateTo === to;
              return (
                <button
                  key={label}
                  type="button"
                  className={`rounded-lg px-3 py-2.5 text-left text-[10px] font-semibold transition ${active ? "bg-brand-soft text-brand" : "text-ink hover:bg-black/4 dark:hover:bg-white/5"}`}
                  onClick={() => selectRange(from, to)}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="min-w-0 border-line xl:border-l xl:pl-4">
          <div className="grid gap-3 md:grid-cols-2">
            <ReportCalendarMonth
              month={calendarMonth}
              dateFrom={dateFrom}
              dateTo={dateTo}
              today={today}
              onSelect={selectCalendarDay}
              previous={() => changeCalendarMonth(-1)}
            />
            <ReportCalendarMonth
              month={secondCalendarMonth}
              dateFrom={dateFrom}
              dateTo={dateTo}
              today={today}
              onSelect={selectCalendarDay}
              next={() => changeCalendarMonth(1)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
