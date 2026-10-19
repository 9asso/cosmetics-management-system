import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  defaultStorefrontSettings,
  type DiscountCodeInput,
  type DiscountCodeItem,
  type StorefrontSettings,
} from "@cosmetics/contracts";
import {
  Boxes,
  CalendarClock,
  Eye,
  FlaskConical,
  PackageCheck,
  Pencil,
  Plus,
  Power,
  Save,
  Shuffle,
  Store,
  TicketPercent,
  Trash2,
  Truck,
} from "lucide-react";
import { ErrorState } from "../components/EmptyState";
import { Modal } from "../components/Modal";
import { StatusPill } from "../components/StatusPill";
import { api, ApiRequestError } from "../lib/api";
import { integer, money } from "../lib/format";
import { ui } from "../lib/ui";

/** Status 499 means the owner cancelled the confirmation dialog. */
const showError = (error: unknown) =>
  !(error instanceof ApiRequestError) || error.status !== 499;
const errorText = (error: unknown, fallback: string) =>
  error instanceof ApiRequestError ? error.message : fallback;

function Choice({
  selected,
  disabled,
  icon,
  title,
  detail,
  onSelect,
}: {
  selected: boolean;
  disabled?: boolean;
  icon: ReactNode;
  title: string;
  detail: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={`flex items-start gap-3 rounded-xl border p-3.5 text-left transition-all disabled:cursor-not-allowed disabled:opacity-45 ${
        selected
          ? "border-brand bg-brand-soft/70 shadow-sm ring-2 ring-brand/15"
          : "border-line bg-white hover:border-brand/50 dark:bg-[#2d282c]"
      }`}
    >
      <span
        className={`grid size-9 shrink-0 place-items-center rounded-lg ${selected ? "bg-brand text-white" : "bg-brand-soft text-brand"}`}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <strong className="block text-xs text-ink">{title}</strong>
        <small className="mt-0.5 block text-[11px] leading-snug text-muted">
          {detail}
        </small>
      </span>
      <span
        className={`mt-1 grid size-4 shrink-0 place-items-center rounded-full border-2 ${selected ? "border-brand" : "border-line"}`}
        aria-hidden="true"
      >
        {selected && <span className="size-1.5 rounded-full bg-brand" />}
      </span>
    </button>
  );
}

export function StorefrontSettingsPanel() {
  const cache = useQueryClient();
  const [draft, setDraft] = useState<StorefrontSettings>(
    defaultStorefrontSettings,
  );
  const [saved, setSaved] = useState(false);
  const settings = useQuery({
    queryKey: ["storefront-settings"],
    queryFn: api.storefrontSettings,
  });
  useEffect(() => {
    if (settings.data) setDraft(settings.data);
  }, [settings.data]);
  const mutation = useMutation({
    mutationFn: () => api.updateStorefrontSettings(draft),
    onSuccess: (value) => {
      cache.setQueryData(["storefront-settings"], value);
      setDraft(value);
      setSaved(true);
    },
  });
  const set = (patch: Partial<StorefrontSettings>) => {
    setSaved(false);
    setDraft({ ...draft, ...patch });
  };

  if (settings.isError)
    return (
      <ErrorState
        message="Impossible de charger les réglages de la boutique."
        retry={() => void settings.refetch()}
      />
    );

  const demo = draft.catalogSource === "DEMO";
  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <form
        className={ui("panel product-form")}
        onSubmit={(event) => {
          event.preventDefault();
          setSaved(false);
          mutation.mutate();
        }}
      >
        <div className={ui("section-title")}>
          <span className={ui("summary-icon pink")}>
            <Store size={20} />
          </span>
          <div>
            <p className={ui("eyebrow")}>Boutique en ligne</p>
            <h2>Catalogue & livraison</h2>
            <small>Les changements s’appliquent immédiatement au site.</small>
          </div>
        </div>
        <fieldset
          disabled={settings.isLoading || mutation.isPending}
          className="space-y-5"
        >
          <div>
            <p className="mb-2 text-xs font-semibold text-muted">
              Produits présentés aux clients
            </p>
            <div
              role="radiogroup"
              aria-label="Produits présentés aux clients"
              className="grid gap-2.5 md:grid-cols-2"
            >
              <Choice
                selected={!demo}
                icon={<Boxes size={18} />}
                title="Produits réels"
                detail="Votre stock, avec les commandes ouvertes."
                onSelect={() => set({ catalogSource: "LIVE" })}
              />
              <Choice
                selected={demo}
                icon={<FlaskConical size={18} />}
                title="Produits de démonstration"
                detail="Un catalogue d’exemple ; les commandes sont fermées."
                onSelect={() => set({ catalogSource: "DEMO" })}
              />
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold text-muted">
              Quels produits réels afficher ?
            </p>
            <div
              role="radiogroup"
              aria-label="Quels produits réels afficher"
              className="grid gap-2.5 md:grid-cols-2"
            >
              <Choice
                selected={draft.productScope === "VISIBLE"}
                disabled={demo}
                icon={<Eye size={18} />}
                title="Marqués « Visible dans la boutique »"
                detail="Seuls les produits dont l’option est cochée, même en rupture."
                onSelect={() => set({ productScope: "VISIBLE" })}
              />
              <Choice
                selected={draft.productScope === "IN_STOCK"}
                disabled={demo}
                icon={<PackageCheck size={18} />}
                title="Tous les produits en stock"
                detail="Chaque produit avec du stock et un prix boutique."
                onSelect={() => set({ productScope: "IN_STOCK" })}
              />
            </div>
          </div>
          <div className={ui("form-grid")}>
            <label>
              <span>Livraison offerte dès (MAD)</span>
              <input
                type="number"
                min={0}
                step="1"
                required
                value={draft.freeShippingThreshold}
                onChange={(event) =>
                  set({ freeShippingThreshold: Number(event.target.value) })
                }
              />
            </label>
            <label>
              <span>Frais de livraison (MAD)</span>
              <input
                type="number"
                min={0}
                step="0.5"
                required
                value={draft.shippingFee}
                onChange={(event) =>
                  set({ shippingFee: Number(event.target.value) })
                }
              />
            </label>
          </div>
        </fieldset>
        {mutation.isError && showError(mutation.error) && (
          <p role="alert" className={ui("form-error")}>
            {errorText(mutation.error, "Enregistrement impossible.")}
          </p>
        )}
        {saved && (
          <p role="status" className={ui("form-success")}>
            La boutique en ligne a été mise à jour.
          </p>
        )}
        <button
          className={`${ui("primary-button")} mt-4 mb-5`}
          disabled={settings.isLoading || mutation.isPending}
        >
          <Save size={16} />
          {mutation.isPending ? "Enregistrement…" : "Enregistrer"}
        </button>
      </form>

      <aside className={`${ui("panel")} p-0! overflow-hidden`}>
        <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
          <span className={ui("overline")}>Aperçu sur le site</span>
          <StatusPill tone={demo ? "warn" : "good"}>
            {demo ? "Mode démo" : "En ligne"}
          </StatusPill>
        </div>
        <div className="bg-[#241a1f] px-4 py-2 text-center text-[10px] font-semibold text-white">
          Livraison offerte dès {integer.format(draft.freeShippingThreshold)}{" "}
          MAD d’achats
        </div>
        <div className="space-y-3 p-4">
          <div className="rounded-xl bg-brand-soft/70 p-3">
            <p className="flex items-center gap-1.5 text-[11px] text-ink">
              <Truck size={14} className="text-brand" /> Plus que{" "}
              <strong>
                {money.format(Math.max(0, draft.freeShippingThreshold - 200))}
              </strong>{" "}
              pour la livraison offerte
            </p>
            <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-white dark:bg-[#2d282c]">
              <i
                className="block h-full rounded-full bg-brand"
                style={{
                  width: `${draft.freeShippingThreshold > 0 ? Math.min(100, (200 / draft.freeShippingThreshold) * 100) : 100}%`,
                }}
              />
            </span>
            <small className="mt-1.5 block text-[10px] text-muted">
              Exemple pour un panier de 200 MAD
            </small>
          </div>
          <dl className="space-y-1.5 text-[11px] [&>div]:flex [&>div]:justify-between [&_dt]:text-muted [&_dd]:font-semibold">
            <div>
              <dt>Livraison</dt>
              <dd>
                {draft.shippingFee > 0
                  ? money.format(draft.shippingFee)
                  : "Toujours offerte"}
              </dd>
            </div>
            <div>
              <dt>Produits affichés</dt>
              <dd>
                {demo
                  ? "Démonstration"
                  : draft.productScope === "IN_STOCK"
                    ? "Tout le stock"
                    : "Marqués visibles"}
              </dd>
            </div>
            <div>
              <dt>Commandes</dt>
              <dd>{demo ? "Fermées" : "Ouvertes"}</dd>
            </div>
          </dl>
        </div>
      </aside>
    </div>
  );
}

const blankCode: DiscountCodeInput = {
  code: "",
  type: "PERCENT",
  value: 10,
  minSubtotal: 0,
  expiresOn: null,
  active: true,
};

const today = () => new Date().toISOString().slice(0, 10);
const isExpired = (code: DiscountCodeItem) =>
  Boolean(code.expiresOn && code.expiresOn < today());
const reductionLabel = (code: Pick<DiscountCodeInput, "type" | "value">) =>
  code.type === "PERCENT" ? `-${code.value} %` : `-${money.format(code.value)}`;
const dateLabel = (value: string) =>
  new Date(`${value}T12:00:00`).toLocaleDateString("fr-MA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

function randomCode() {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return `YAMOURA${Array.from({ length: 4 }, () => letters[Math.floor(Math.random() * letters.length)]).join("")}`;
}

function DiscountCodeModal({
  editing,
  onClose,
}: {
  editing: DiscountCodeItem | null;
  onClose: () => void;
}) {
  const cache = useQueryClient();
  const [draft, setDraft] = useState<DiscountCodeInput>(
    editing
      ? {
          code: editing.code,
          type: editing.type,
          value: editing.value,
          minSubtotal: editing.minSubtotal,
          expiresOn: editing.expiresOn,
          active: editing.active,
        }
      : blankCode,
  );
  const save = useMutation({
    mutationFn: () =>
      editing
        ? api.updateDiscountCode(editing.id, draft)
        : api.createDiscountCode(draft),
    onSuccess: () => {
      void cache.invalidateQueries({ queryKey: ["discount-codes"] });
      onClose();
    },
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    save.mutate();
  };
  return (
    <Modal
      title={editing ? `Modifier ${editing.code}` : "Nouveau code de réduction"}
      subtitle="Les clients le saisissent dans leur panier sur la boutique."
      onClose={() => {
        if (!save.isPending) onClose();
      }}
    >
      <form className={ui("product-form")} onSubmit={submit}>
        <div className={ui("form-grid")}>
          <label className="sm:col-span-2">
            <span>Code</span>
            <div className="flex gap-2">
              <input
                required
                minLength={2}
                maxLength={40}
                pattern="[A-Za-z0-9_\-]{2,40}"
                title="Lettres, chiffres, tirets ou soulignés"
                className="font-mono font-bold tracking-widest uppercase"
                value={draft.code}
                onChange={(event) =>
                  setDraft({ ...draft, code: event.target.value.toUpperCase() })
                }
                placeholder="BIENVENUE10"
              />
              <button
                type="button"
                className={ui("secondary-button")}
                onClick={() => setDraft({ ...draft, code: randomCode() })}
              >
                <Shuffle size={14} /> Générer
              </button>
            </div>
          </label>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-muted">Type</span>
            <div className={ui("segmented")} role="group" aria-label="Type de réduction">
              {(
                [
                  ["PERCENT", "Pourcentage"],
                  ["FIXED", "Montant fixe"],
                ] as const
              ).map(([type, label]) => (
                <button
                  key={type}
                  type="button"
                  className={`flex-1 justify-center ${ui(draft.type === type ? "active" : "")}`}
                  aria-pressed={draft.type === type}
                  onClick={() => setDraft({ ...draft, type })}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <label>
            <span>{draft.type === "PERCENT" ? "Réduction (%)" : "Réduction (MAD)"}</span>
            <input
              type="number"
              required
              min={0.01}
              max={draft.type === "PERCENT" ? 100 : undefined}
              step="0.01"
              value={draft.value}
              onChange={(event) =>
                setDraft({ ...draft, value: Number(event.target.value) })
              }
            />
          </label>
          <label>
            <span>Achat minimum (MAD)</span>
            <input
              type="number"
              min={0}
              step="1"
              value={draft.minSubtotal}
              onChange={(event) =>
                setDraft({ ...draft, minSubtotal: Number(event.target.value) })
              }
            />
          </label>
          <label>
            <span>Dernier jour de validité (facultatif)</span>
            <input
              type="date"
              value={draft.expiresOn ?? ""}
              onChange={(event) =>
                setDraft({ ...draft, expiresOn: event.target.value || null })
              }
            />
          </label>
        </div>
        <label className={ui("checkbox")}>
          <input
            type="checkbox"
            checked={draft.active}
            onChange={(event) =>
              setDraft({ ...draft, active: event.target.checked })
            }
          />
          <span>Utilisable sur la boutique</span>
        </label>
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-dashed border-brand/40 bg-brand-soft/50 px-4 py-3">
          <TicketPercent size={20} className="shrink-0 text-brand" />
          <p className="text-xs text-ink">
            <strong className="font-mono tracking-widest">
              {draft.code || "CODE"}
            </strong>{" "}
            · {reductionLabel(draft)}
            {draft.minSubtotal > 0 &&
              ` dès ${money.format(draft.minSubtotal)} d’achats`}
            {draft.expiresOn && `, jusqu’au ${dateLabel(draft.expiresOn)}`}
          </p>
        </div>
        {save.isError && showError(save.error) && (
          <p role="alert" className={ui("form-error")}>
            {errorText(save.error, "Enregistrement impossible.")}
          </p>
        )}
        <footer className={ui("modal-actions")}>
          <button
            type="button"
            className={ui("secondary-button")}
            disabled={save.isPending}
            onClick={onClose}
          >
            Annuler
          </button>
          <button className={ui("primary-button")} disabled={save.isPending}>
            {save.isPending
              ? "Enregistrement…"
              : editing
                ? "Enregistrer"
                : "Créer le code"}
          </button>
        </footer>
      </form>
    </Modal>
  );
}

export function DiscountCodesPanel() {
  const cache = useQueryClient();
  const [editing, setEditing] = useState<DiscountCodeItem | null>(null);
  const [creating, setCreating] = useState(false);
  const codes = useQuery({
    queryKey: ["discount-codes"],
    queryFn: api.discountCodes,
  });
  const toggle = useMutation({
    mutationFn: (code: DiscountCodeItem) =>
      api.updateDiscountCode(code.id, {
        code: code.code,
        type: code.type,
        value: code.value,
        minSubtotal: code.minSubtotal,
        expiresOn: code.expiresOn,
        active: !code.active,
      }),
    onSuccess: () => cache.invalidateQueries({ queryKey: ["discount-codes"] }),
  });
  const remove = useMutation({
    mutationFn: (code: DiscountCodeItem) => api.deleteDiscountCode(code.id),
    onSuccess: () => cache.invalidateQueries({ queryKey: ["discount-codes"] }),
  });

  if (codes.isError)
    return (
      <ErrorState
        message={errorText(codes.error, "Impossible de charger les codes.")}
        retry={() => void codes.refetch()}
      />
    );
  const list = codes.data ?? [];
  const usable = list.filter((code) => code.active && !isExpired(code));
  const actionError = [toggle.error, remove.error].find(
    (error) => error && showError(error),
  );
  return (
    <div className={ui("page-stack")}>
      <section className={ui("summary-strip")}>
        <div>
          <span className={ui("summary-icon pink")}>
            <TicketPercent size={19} />
          </span>
          <small>Codes créés</small>
          <strong>{list.length}</strong>
        </div>
        <div>
          <span className={ui("summary-icon green")}>
            <Power size={19} />
          </span>
          <small>Utilisables</small>
          <strong>{usable.length}</strong>
        </div>
        <div>
          <span className={ui("summary-icon gold")}>
            <Store size={19} />
          </span>
          <small>Commandes avec code</small>
          <strong>
            {list.reduce((sum, code) => sum + code.usageCount, 0)}
          </strong>
        </div>
        <button
          className={ui("primary-button push-right")}
          onClick={() => setCreating(true)}
        >
          <Plus size={17} /> Nouveau code
        </button>
      </section>
      <section className={ui("panel data-panel")}>
        {actionError && (
          <p role="alert" className={ui("inline-error")}>
            {errorText(actionError, "Mise à jour impossible.")}
          </p>
        )}
        <div className={ui("table-wrap")}>
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Réduction</th>
                <th>Achat minimum</th>
                <th>Validité</th>
                <th>Utilisations</th>
                <th>État</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {codes.isLoading && (
                <tr>
                  <td colSpan={7} className={ui("loading-cell")}>
                    Chargement des codes…
                  </td>
                </tr>
              )}
              {!codes.isLoading && list.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12! text-center">
                    <TicketPercent
                      size={26}
                      className="mx-auto mb-2 text-brand"
                    />
                    <strong className="block text-xs">
                      Aucun code de réduction
                    </strong>
                    <small className="text-[11px] text-muted">
                      Créez un code pour vos clientes fidèles ou vos campagnes
                      Instagram.
                    </small>
                  </td>
                </tr>
              )}
              {list.map((code) => {
                const expired = isExpired(code);
                return (
                  <tr key={code.id}>
                    <td>
                      <strong className="font-mono tracking-widest">
                        {code.code}
                      </strong>
                    </td>
                    <td>
                      <strong className="text-brand">
                        {reductionLabel(code)}
                      </strong>
                    </td>
                    <td>
                      {code.minSubtotal > 0
                        ? money.format(code.minSubtotal)
                        : "Aucun"}
                    </td>
                    <td>
                      {code.expiresOn ? (
                        <span className="inline-flex items-center gap-1">
                          <CalendarClock size={13} className="text-muted" />
                          Jusqu’au {dateLabel(code.expiresOn)}
                        </span>
                      ) : (
                        "Sans limite"
                      )}
                    </td>
                    <td>{code.usageCount}</td>
                    <td>
                      <StatusPill
                        tone={
                          !code.active ? "neutral" : expired ? "warn" : "good"
                        }
                      >
                        {!code.active
                          ? "Désactivé"
                          : expired
                            ? "Expiré"
                            : "Actif"}
                      </StatusPill>
                    </td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        <button
                          className={ui("secondary-button compact")}
                          aria-label={`Modifier ${code.code}`}
                          onClick={() => setEditing(code)}
                        >
                          <Pencil size={13} /> Modifier
                        </button>
                        <button
                          className={ui("secondary-button compact")}
                          disabled={toggle.isPending}
                          onClick={() => toggle.mutate(code)}
                        >
                          <Power size={13} />
                          {code.active ? "Désactiver" : "Activer"}
                        </button>
                        <button
                          className={ui("icon-button")}
                          aria-label={`Supprimer ${code.code}`}
                          disabled={remove.isPending}
                          onClick={() => remove.mutate(code)}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      {(creating || editing) && (
        <DiscountCodeModal
          key={editing?.id ?? "new"}
          editing={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}
