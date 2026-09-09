import { twMerge } from "tailwind-merge";

// Shared Tailwind recipes. Keep complete utility names here so Vite can discover
// them statically. Semantic markers are only hooks for parent/child variants;
// there are no corresponding CSS rules or runtime-generated utility names.
const card =
  "rounded-xl border border-line bg-white shadow-sm transition-colors dark:bg-[#282428] dark:shadow-none";
const button =
  "inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-50";
const form =
  "[&_label]:flex [&_label]:min-w-0 [&_label]:flex-col [&_label]:gap-1.5 [&_label>span]:text-xs [&_label>span]:font-semibold [&_label>span]:text-muted [&_input]:w-full [&_select]:w-full [&_textarea]:w-full [&_input]:rounded-lg [&_select]:rounded-lg [&_textarea]:rounded-lg [&_input]:border [&_select]:border [&_textarea]:border [&_input]:border-line [&_select]:border-line [&_textarea]:border-line [&_input]:bg-surface [&_select]:bg-surface [&_textarea]:bg-surface [&_input]:px-3 [&_select]:px-3 [&_textarea]:px-3 [&_input]:py-2 [&_select]:py-2 [&_textarea]:py-2 [&_input]:text-xs [&_select]:text-xs [&_textarea]:text-xs [&_input]:outline-none [&_select]:outline-none [&_textarea]:outline-none [&_input:focus]:border-brand [&_select:focus]:border-brand [&_textarea:focus]:border-brand [&_input:focus]:ring-2 [&_select:focus]:ring-2 [&_textarea:focus]:ring-2 [&_input:focus]:ring-brand/15 [&_select:focus]:ring-brand/15 [&_textarea:focus]:ring-brand/15";
const toolbar =
  "flex flex-wrap items-center gap-2 border-b border-line px-3.5 py-3";
const tones = {
  good: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/55 dark:text-emerald-300",
  warn: "bg-amber-50 text-amber-700 dark:bg-amber-950/55 dark:text-amber-300",
  bad: "bg-rose-50 text-rose-700 dark:bg-rose-950/55 dark:text-rose-300",
  neutral: "bg-sky-50 text-sky-700 dark:bg-sky-950/55 dark:text-sky-300",
};

export const recipes: Record<string, string> = {
  "app-shell":
    "group/shell flex min-h-screen bg-[#f8f8f8] transition-colors dark:bg-[#171518]",
  "sidebar-collapsed": "",
  sidebar:
    "fixed inset-y-0 left-0 z-30 flex w-[250px] -translate-x-full flex-col overflow-y-auto px-3 pb-2 pt-4 text-ink transition-all max-md:bg-rose-50 dark:max-md:bg-[#211e21] md:translate-x-0 md:group-[.sidebar-collapsed]/shell:w-[68px]",
  "mobile-open": "translate-x-0 shadow-xl md:shadow-none",
  "mobile-backdrop": "fixed inset-0 z-20 bg-black/35 md:hidden",
  brand:
    "relative border-b border-dashed border-black/25 flex items-center gap-2 px-1 pb-3 mb-5 [&>div]:flex [&>div]:min-w-0 [&>div]:flex-col [&_strong]:text-base [&_strong]:font-bold [&_small]:mt-0.5 [&_small]:whitespace-nowrap [&_small]:text-[9px] [&_small]:text-muted md:group-[.sidebar-collapsed]/shell:pb-14 md:group-[.sidebar-collapsed]/shell:[&>div]:hidden",
  "brand-mark": "size-9 shrink-0 rounded-xl shadow-sm",
  "collapse-button":
    "ml-auto hidden h-7 w-6 shrink-0 place-items-center rounded-md text-muted hover:bg-white dark:hover:bg-white/10 md:grid md:group-[.sidebar-collapsed]/shell:absolute md:group-[.sidebar-collapsed]/shell:top-12 md:group-[.sidebar-collapsed]/shell:left-2",
  "nav-group": "mb-5 md:group-[.sidebar-collapsed]/shell:mb-3",
  "nav-label":
    "px-2.5 pb-2 text-[10px] font-medium text-muted md:group-[.sidebar-collapsed]/shell:hidden",
  "nav-item":
    "my-0.5 flex min-h-9 w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-ink transition-colors hover:bg-white/70 dark:hover:bg-white/8 [&_svg]:shrink-0 [&_svg]:stroke-[1.8] [&_span]:flex-1 [&_span]:text-[11px] [&_span]:font-semibold md:group-[.sidebar-collapsed]/shell:justify-center md:group-[.sidebar-collapsed]/shell:px-0 md:group-[.sidebar-collapsed]/shell:[&_span]:hidden",
  active:
    "bg-brand text-white shadow-sm hover:bg-brand/90 dark:text-white dark:hover:bg-brand/90 md:group-[.sidebar-collapsed]/shell:bg-brand/90",
  "nav-chevron": "rotate-180 md:group-[.sidebar-collapsed]/shell:hidden",
  "sidebar-footer":
    "mt-auto p-3 bg-brand md:group-[.sidebar-collapsed]/shell:hidden rounded-2xl ",
  "store-link":
    "flex w-full hover:scale-[1.025] transition-all delay-75 items-center gap-2.5 rounded-2xl  border-brand/15 bg-white -mt-9 shadow-[0px_0px_20px_rgba(60,28,41,0.1)] p-2.5 text-left text-brand hover:bg-white dark:bg-[#2d282c] dark:hover:bg-[#342e33] [&_svg]:shrink-0 [&_span]:flex [&_span]:flex-col [&_strong]:text-[11px] [&_small]:mt-0.5 [&_small]:text-[9px] [&_small]:text-muted md:group-[.sidebar-collapsed]/shell:justify-center md:group-[.sidebar-collapsed]/shell:px-0 md:group-[.sidebar-collapsed]/shell:[&_span]:hidden",
  "sidebar-account-label":
    "mx-2.5 mt-5 mb-2 text-[10px] text-muted md:group-[.sidebar-collapsed]/shell:hidden",
  profile:
    "mt-2 flex items-center gap-2 px-1 py-1 [&_strong]:block [&_strong]:truncate [&_strong]:text-xs [&_small]:block [&_small]:text-[10px] [&_small]:text-muted [&>button]:shrink-0 [&>button]:p-1 [&>button]:text-muted md:group-[.sidebar-collapsed]/shell:mt-4 md:group-[.sidebar-collapsed]/shell:justify-center md:group-[.sidebar-collapsed]/shell:[&>div]:hidden md:group-[.sidebar-collapsed]/shell:[&>button]:hidden",
  avatar:
    "grid size-8.5 shrink-0 place-items-center rounded-full bg-linear-to-br from-brand to-brand-secondary text-[11px] font-bold text-white ring-1 ring-white/35",
  "main-area":
    "min-w-0 flex-1 bg-surface shadow-[0px_0px_15px_rgba(60,28,41,0.085)] transition-colors dark:shadow-[0_0_22px_rgba(0,0,0,.3)] md:m-2 md:ml-[250px] md:rounded-[19px] md:border md:border-line md:group-[.sidebar-collapsed]/shell:ml-[68px]",
  topbar:
    "sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-line bg-white/95 px-3.5 backdrop-blur-md transition-colors dark:bg-[#211e21]/95 md:h-[59px] md:rounded-t-[19px] md:px-5",
  "mobile-menu-button":
    "grid size-9 shrink-0 place-items-center rounded-lg border border-line bg-white dark:bg-[#2d282c] md:hidden",
  breadcrumb:
    "flex items-center gap-2 text-[10px] text-muted [&_strong]:text-ink max-md:[&>span]:hidden max-md:[&>svg]:hidden",
  "top-actions":
    "ml-auto flex gap-2 [&_button]:min-h-8 [&_button]:rounded-lg [&_button]:px-2.5 [&_button]:py-1.5 [&_button]:text-[10px] max-lg:[&_.secondary-button]:hidden max-md:[&_.primary-button]:w-8 max-md:[&_.primary-button]:text-[0px] max-md:[&_.primary-button]:gap-0",
  "primary-button": `${button} border border-transparent bg-linear-to-r from-brand to-brand-secondary text-white shadow-sm transition-all hover:brightness-95 active:scale-[.98]`,
  "secondary-button": `${button} border border-line bg-linear-to-r from-white to-brand-soft/60 text-ink hover:border-brand-secondary hover:from-brand-soft hover:to-white dark:from-[#302a2f] dark:to-[#39272b] dark:hover:from-[#39272b] dark:hover:to-[#302a2f]`,
  "theme-toggle": `${button} border border-line bg-white text-ink hover:border-brand hover:text-brand dark:bg-[#2d282c]`,
  "text-button":
    "mt-3 inline-flex items-center gap-1.5 py-1 text-[11px] font-semibold text-brand hover:underline",
  "icon-button":
    "grid size-8.5 shrink-0 place-items-center rounded-lg text-muted hover:bg-brand-soft hover:text-brand",
  compact: "px-2 py-1.5 text-[10px]",
  page: "mx-auto w-full px-3.5 py-4 md:px-5 md:pt-5 md:pb-7",
  "page-heading":
    "mb-4 flex flex-wrap items-end justify-between gap-3 [&_p]:mb-1 [&_p]:text-[9px] [&_p]:font-bold [&_p]:tracking-widest [&_p]:text-brand [&_p]:uppercase [&_h1]:text-[23px] [&_h1]:leading-tight [&_h1]:font-bold [&_h1]:tracking-tight [&_small]:mt-1 [&_small]:block [&_small]:text-[11px] [&_small]:text-muted",
  connection:
    "inline-flex items-center gap-2 whitespace-nowrap text-[9px] text-muted [&_i]:size-1.5 [&_i]:rounded-full [&_i]:bg-emerald-500 [&_i]:ring-3 [&_i]:ring-emerald-100",
  offline: "[&_i]:bg-rose-500 [&_i]:ring-rose-100",
  "app-loading":
    "flex min-h-screen items-center justify-center gap-3 text-muted [&_span]:size-5 [&_span]:animate-spin [&_span]:rounded-full [&_span]:border-2 [&_span]:border-brand-soft [&_span]:border-t-brand",
  "dashboard-stack": "flex flex-col gap-3.5",
  "inventory-stack": "flex flex-col gap-3.5",
  "page-stack": "flex flex-col gap-3.5",
  "metric-grid":
    "grid grid-cols-1 gap-3 min-[30rem]:grid-cols-2 min-[68.75rem]:grid-cols-5",
  "metric-card": `${card} relative overflow-hidden px-4 py-3.5 [&>strong]:my-1.5 [&>strong]:block [&>strong]:text-[22px] [&>strong]:font-bold [&>strong]:tracking-tight [&>small]:text-[10px] [&>small]:text-muted`,
  "metric-top":
    "flex items-center justify-between gap-2 text-[11px] text-muted [&_i]:grid [&_i]:size-8 [&_i]:shrink-0 [&_i]:place-items-center [&_i]:rounded-lg",
  "metric-ink": "[&_i]:bg-brand-soft [&_i]:text-brand",
  "metric-green":
    "[&_i]:bg-emerald-50 [&_i]:text-emerald-700 dark:[&_i]:bg-emerald-950/55 dark:[&_i]:text-emerald-300",
  "metric-gold":
    "[&_i]:bg-amber-50 [&_i]:text-amber-700 dark:[&_i]:bg-amber-950/55 dark:[&_i]:text-amber-300",
  "metric-rose":
    "[&_i]:bg-rose-50 [&_i]:text-rose-700 dark:[&_i]:bg-rose-950/55 dark:[&_i]:text-rose-300",
  "dashboard-grid":
    "grid grid-cols-1 gap-3.5 lg:grid-cols-[minmax(0,1.65fr)_minmax(280px,0.8fr)]",
  "lower-grid": "lg:grid-cols-[minmax(0,1.2fr)_minmax(300px,1fr)]",
  panel: `${card} min-w-0 p-4`,
  "performance-panel": "",
  "alerts-panel": "",
  "quick-panel": "",
  "activity-panel": "",
  "panel-heading":
    "mb-3 flex items-start justify-between gap-2 [&_h2]:mt-1 [&_h2]:text-sm [&_h2]:font-bold [&_select]:rounded-lg [&_select]:border [&_select]:border-line [&_select]:p-2 [&_select]:text-xs",
  overline: "text-[9px] font-bold tracking-widest text-muted uppercase",
  "live-label": "text-[10px] text-muted",
  "chart-placeholder":
    "relative h-44 pt-2 pr-1 pb-5 pl-9 before:absolute before:inset-[8px_4px_20px_36px] before:bg-[repeating-linear-gradient(to_bottom,transparent_0,transparent_calc(33.33%_-_1px),#ede7e9_33.33%)]",
  "chart-y":
    "absolute top-0.5 bottom-5 left-0 flex flex-col justify-between text-[9px] text-muted",
  "chart-bars":
    "relative flex h-full items-end gap-2 [&>span]:relative [&>span]:h-[var(--height)] [&>span]:min-w-1 [&>span]:flex-1 [&>span]:rounded-t [&>span]:bg-linear-to-t [&>span]:from-brand [&>span]:to-brand-secondary [&_i]:absolute [&_i]:inset-x-0.5 [&_i]:bottom-0 [&_i]:h-[63%] [&_i]:rounded-t [&_i]:bg-rose-200",
  "chart-x":
    "absolute right-1 bottom-0 left-9 flex justify-between text-[9px] text-muted",
  "chart-legend":
    "mt-2 flex justify-center gap-5 text-[10px] text-muted [&_span]:flex [&_span]:items-center [&_span]:gap-1.5 [&_i]:size-2 [&_i]:rounded-sm",
  "legend-sales": "bg-brand",
  "legend-margin": "bg-rose-200",
  "alert-row":
    "flex w-full items-center gap-3 border-b border-line py-2.5 text-left hover:bg-surface [&>div]:flex [&>div]:flex-1 [&>div]:flex-col [&_strong]:text-xs [&_small]:mt-0.5 [&_small]:text-[10px] [&_small]:text-muted [&>svg]:text-muted",
  "alert-icon": "grid size-8 shrink-0 place-items-center rounded-lg",
  warning: tones.warn,
  danger: tones.bad,
  blue: tones.neutral,
  green: tones.good,
  gold: tones.warn,
  amber: tones.warn,
  pink: "bg-brand-soft text-brand",
  "quick-actions":
    "grid grid-cols-1 gap-2 min-[30rem]:grid-cols-3 [&_button]:flex [&_button]:min-h-24 [&_button]:flex-col [&_button]:items-start [&_button]:rounded-xl [&_button]:border [&_button]:border-line [&_button]:bg-brand-soft/40 [&_button]:p-3 [&_button]:text-left [&_button]:transition-colors [&_button:hover]:bg-brand-soft [&_span]:mb-2 [&_span]:text-brand [&_strong]:text-xs [&_small]:mt-1 [&_small]:text-[10px] [&_small]:text-muted",
  "activity-row":
    "flex items-center gap-3 px-1 py-2 [&_div]:flex [&_div]:flex-1 [&_div]:flex-col [&_strong]:text-xs [&_small]:mt-0.5 [&_small]:text-[10px] [&_small]:text-muted [&_time]:text-[10px] [&_time]:text-muted",
  "activity-dot":
    "size-2 shrink-0 rounded-full bg-current ring-4 ring-current/10",
  "inventory-summary": `${card} grid grid-cols-1 items-center gap-3 px-4 py-3 sm:grid-cols-3 min-[68.75rem]:grid-cols-[1fr_1fr_1fr_auto] [&>div]:flex [&>div]:flex-col [&>div]:border-line sm:[&>div]:border-r [&_small]:text-[10px] [&_small]:text-muted [&_strong]:mt-1 [&_strong]:text-base [&_strong]:font-bold [&_button]:col-span-full min-[68.75rem]:[&_button]:col-auto`,
  "inventory-panel": "overflow-hidden p-0",
  "data-panel": "overflow-hidden p-0",
  "inventory-toolbar": `${toolbar} [&>.secondary-button]:ml-auto`,
  "data-toolbar": `${toolbar} [&>select]:h-8 [&>select]:rounded-lg [&>select]:border [&>select]:border-line [&>select]:bg-surface [&>select]:px-2 [&>select]:text-[11px]`,
  "table-search":
    "flex h-8 w-full items-center gap-2 rounded-lg border border-line bg-surface px-3 text-muted focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/15 lg:w-[min(360px,30vw)] [&_svg]:shrink-0 [&_input]:min-w-0 [&_input]:w-full [&_input]:bg-transparent [&_input]:text-[11px] [&_input]:text-ink [&_input]:outline-none",
  segmented:
    "flex gap-1 rounded-lg bg-stone-100 text-ink dark:bg-[#302b2f] p-1 [&_button]:inline-flex [&_button]:items-center [&_button]:gap-1.5 [&_button]:rounded-md [&_button]:px-2.5 [&_button]:py-1 [&_button]:text-[11px] [&_button]:font-semibold",
  "category-filter":
    "flex h-8 items-center gap-1.5 rounded-lg border border-line bg-surface px-2 text-[11px] text-muted [&_select]:min-w-0 [&_select]:bg-transparent [&_select]:outline-none",
  "table-wrap":
    "overflow-x-auto [&_table]:w-full [&_table]:border-collapse [&_table]:text-[11px] [&_th]:bg-surface [&_th]:px-3 [&_th]:py-2.5 [&_th]:text-left [&_th]:text-[9px] [&_th]:font-bold [&_th]:tracking-wider [&_th]:whitespace-nowrap [&_th]:text-muted [&_th]:uppercase [&_td]:border-t [&_td]:border-line [&_td]:px-3 [&_td]:py-2.5 [&_td]:whitespace-nowrap [&_td]:text-muted [&_td>strong]:text-ink [&_tbody_tr:hover]:bg-brand-soft/30",
  "product-cell":
    "flex items-center gap-2.5 [&>img]:size-8 [&>img]:shrink-0 [&>img]:rounded-lg [&>img]:border [&>img]:border-line [&>img]:bg-white [&>img]:object-contain [&>span]:grid [&>span]:size-8 [&>span]:shrink-0 [&>span]:place-items-center [&>span]:rounded-lg [&>span]:bg-brand-soft [&>span]:text-brand [&>div]:flex [&>div]:min-w-0 [&>div]:flex-col [&_strong]:line-clamp-2 [&_strong]:w-[clamp(170px,16vw,280px)] [&_strong]:text-[11px] [&_strong]:leading-snug [&_strong]:whitespace-normal [&_strong]:text-ink [&_small]:mt-0.5 [&_small]:max-w-[clamp(170px,16vw,280px)] [&_small]:truncate [&_small]:text-[9px] [&_small]:text-muted",
  mono: "font-mono text-[10px] text-muted",
  "sub-cell": "mt-0.5 block text-[9px] text-muted",
  "loading-cell": "py-10! text-center text-muted",
  "table-footer":
    "flex flex-wrap items-center justify-between gap-2 border-t border-line px-3.5 py-2.5 text-[10px] text-muted",
  "status-pill":
    "inline-flex items-center gap-1 rounded-full px-2 py-1 text-[9px] font-bold before:size-1 before:rounded-full before:bg-current",
  "status-good": tones.good,
  "status-warn": tones.warn,
  "status-bad": tones.bad,
  "status-neutral": tones.neutral,
  "modal-backdrop":
    "fixed inset-0 z-50 grid place-items-center bg-black/40 p-3 backdrop-blur-sm sm:p-7",
  modal:
    "max-h-[92dvh] w-full max-w-[700px] overflow-y-auto rounded-2xl border border-white/50 bg-white text-ink shadow-2xl dark:border-line dark:bg-[#282428]",
  "modal-header":
    "sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-line bg-white/95 px-6 pt-5 pb-4 backdrop-blur-md dark:bg-[#282428]/95 [&_h2]:text-lg [&_h2]:font-bold [&_p]:mt-1 [&_p]:text-xs [&_p]:text-muted",
  "product-form": `${form} px-6 pt-5`,
  "form-grid": "grid grid-cols-1 gap-3 sm:grid-cols-2",
  "full-field": "mt-3.5 [&_textarea]:min-h-22 [&_textarea]:resize-y",
  checkbox:
    "mt-4 flex-row! items-center [&_input]:w-auto! [&_input]:accent-brand",
  "form-error":
    "my-3 rounded-lg bg-rose-50 px-3 py-2.5 text-xs text-rose-700 dark:bg-rose-950/55 dark:text-rose-300",
  "inline-error":
    "bg-rose-50 px-4 py-3 text-xs text-rose-700 dark:bg-rose-950/55 dark:text-rose-300",
  "form-success":
    "my-3 flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-700 dark:bg-emerald-950/55 dark:text-emerald-300",
  "form-hint": "my-3 text-xs text-muted",
  "modal-actions":
    "mt-5 flex flex-wrap justify-end gap-2 border-t border-line py-4",
  "summary-strip": `${card} flex flex-wrap items-center gap-3 px-3.5 py-3 [&>div]:grid [&>div]:min-w-[150px] [&>div]:grid-cols-[32px_auto] [&>div]:gap-x-2.5 [&>div]:border-r [&>div]:border-line [&>div]:pr-5 [&_small]:text-[10px] [&_small]:text-muted [&_strong]:text-base [&_strong]:font-bold`,
  "summary-icon":
    "row-span-2 grid size-8 shrink-0 place-items-center rounded-lg",
  "push-right": "ml-auto",
  "channel-label": "inline-flex items-center gap-1.5",
  "row-actions":
    "flex items-center gap-1.5 [&_button]:grid [&_button]:size-8 [&_button]:place-items-center [&_button]:rounded-lg [&_button]:border [&_button]:border-line [&_button]:bg-linear-to-r [&_button]:from-white [&_button]:to-brand-soft/70 dark:[&_button]:from-[#302a2f] dark:[&_button]:to-[#39272b] [&_button:hover]:border-brand [&_span]:text-[10px] [&_span]:text-muted",
  "operation-layout":
    "grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[minmax(0,1.65fr)_minmax(280px,0.75fr)]",
  "operation-form": `${form} p-5 [&>.primary-button]:mt-4`,
  "section-title":
    "mb-4 flex items-center gap-3 [&_h2]:my-0.5 [&_h2]:text-base [&_h2]:font-bold [&_small]:text-[11px] [&_small]:text-muted",
  eyebrow: "text-[10px] font-bold tracking-widest text-brand uppercase",
  "operation-aside": "flex flex-col gap-3",
  "total-card":
    "[&_h3]:mt-2 [&_h3]:mb-4 [&_h3]:text-base [&_h3]:font-bold [&>div]:flex [&>div]:justify-between [&>div]:gap-3 [&>div]:border-b [&>div]:border-line [&>div]:py-3 [&>div]:text-xs [&>div]:text-muted [&_strong]:text-ink [&>small]:mt-3 [&>small]:block [&>small]:text-[10px] [&>small]:text-muted",
  grand: "py-4! [&_strong]:text-lg! [&_strong]:text-brand!",
  "process-card":
    "flex flex-col rounded-xl border border-brand/15 bg-brand-soft p-4 text-brand [&_strong]:mt-2.5 [&_strong]:text-xs [&_p]:mt-1 [&_p]:text-[11px] [&_p]:leading-relaxed [&_p]:text-muted",
  sale: "dark:border-emerald-50/20 dark:bg-emerald-50/10 border-emerald-100 bg-emerald-50 text-emerald-700",
  "partner-grid": "grid grid-cols-1 gap-3 p-3.5 sm:grid-cols-2 xl:grid-cols-3",
  "partner-card":
    "flex min-w-0 items-start gap-3 rounded-xl border border-line bg-surface p-3 [&>span]:grid [&>span]:size-9 [&>span]:shrink-0 [&>span]:place-items-center [&>span]:rounded-lg [&>span]:bg-brand-soft [&>span]:text-brand [&>div]:flex [&>div]:min-w-0 [&>div]:flex-col [&_strong]:text-xs [&_small]:mt-1 [&_small]:truncate [&_small]:text-[10px] [&_small]:text-muted [&_em]:mt-2 [&_em]:text-[10px] [&_em]:text-brand [&_em]:not-italic",
  "empty-state": `${card} flex min-h-44 flex-wrap items-center justify-center gap-4 p-7 [&_div]:max-w-md [&_strong]:text-sm [&_p]:mt-1 [&_p]:text-xs [&_p]:text-muted`,
  "empty-icon":
    "grid size-12 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand",
  "login-page":
    "grid min-h-screen grid-cols-1 bg-white md:grid-cols-[1.4fr_0.6fr]",
  "login-story":
    "relative hidden flex-col justify-between gap-12 m-3 rounded-4xl isolate overflow-hidden bg-brand-soft [&>div:not(.absolute)]:relative [&>span]:relative p-[clamp(12px,3vw,50px)] text-ink md:flex [&_h1]:my-4 [&_h1]:max-w-[620px] [&_h1]:text-[clamp(35px,4vw,57px)] [&_h1]:leading-[1.08] [&_h1]:font-bold [&_h1]:tracking-[-0.055em] [&_.eyebrow]:text-brand [&>div>p:not(.eyebrow)]:max-w-lg [&>div>p:not(.eyebrow)]:text-sm [&>div>p:not(.eyebrow)]:leading-relaxed",
  "login-brand":
    "flex items-center gap-3 text-lg font-semibold [&_img]:size-11 [&_img]:rounded-xl [&_img]:ring-1 [&_img]:ring-white/30",
  "login-benefits":
    "mt-7 flex flex-wrap gap-2.5 [&_span]:flex [&_span]:items-center [&_span]:gap-2 [&_span]:rounded-lg [&_span]:border [&_span]:border-white/70 [&_span]:bg-white/65 [&_span]:px-3 [&_span]:py-2.5 [&_span]:text-[11px]",
  "login-panel": "grid place-items-center px-6 py-12 sm:p-9",
  "login-card": `${form} flex w-full max-w-[390px] flex-col [&_h2]:mt-2 [&_h2]:mb-2 [&_h2]:text-[28px] [&_h2]:font-bold [&_h2]:tracking-tight [&>p:not(.eyebrow):not(.form-error)]:mb-6 [&>p:not(.eyebrow):not(.form-error)]:text-xs [&>p:not(.eyebrow):not(.form-error)]:leading-relaxed [&>p:not(.eyebrow):not(.form-error)]:text-muted [&_label]:mb-4 [&_input]:py-3`,
  "login-icon":
    "mb-4 grid size-12 place-items-center rounded-2xl bg-brand-soft text-brand",
  "login-submit": "mt-1 min-h-11",
};

const variantHooks = new Set([
  "sidebar-collapsed",
  "primary-button",
  "secondary-button",
  "eyebrow",
  "form-error",
]);

export function ui(...values: Array<string | false | null | undefined>) {
  return twMerge(
    values
      .filter(Boolean)
      .flatMap((value) => String(value).split(/\s+/))
      .flatMap((token) =>
        token in recipes
          ? [variantHooks.has(token) ? token : "", recipes[token]!]
          : [token],
      )
      .join(" "),
  );
}
