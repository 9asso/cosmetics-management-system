import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { BrandSettings } from "@cosmetics/contracts";
import { Building2, ReceiptText, Save } from "lucide-react";
import { ErrorState } from "../components/EmptyState";
import { api, ApiRequestError } from "../lib/api";
import { defaultBrandSettings } from "../lib/brand-settings";
import { ui } from "../lib/ui";

export function SettingsPage() {
  const cache = useQueryClient();
  const [draft, setDraft] = useState<BrandSettings>(defaultBrandSettings);
  const [saved, setSaved] = useState(false);
  const settings = useQuery({
    queryKey: ["brand-settings"],
    queryFn: api.brandSettings,
  });
  useEffect(() => {
    if (settings.data) setDraft(settings.data);
  }, [settings.data]);
  const mutation = useMutation({
    mutationFn: () => api.updateBrandSettings(draft),
    onSuccess: (value) => {
      cache.setQueryData(["brand-settings"], value);
      setDraft(value);
      setSaved(true);
    },
  });

  if (settings.isError)
    return (
      <ErrorState
        message="Impossible de charger les paramètres de facture."
        retry={() => void settings.refetch()}
      />
    );

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
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
            <Building2 size={20} />
          </span>
          <div>
            <p className={ui("eyebrow")}>En-tête de facture</p>
            <h2>Identité de la marque</h2>
            <small>Ces informations apparaissent sur chaque PDF.</small>
          </div>
        </div>
        <fieldset
          disabled={settings.isLoading || mutation.isPending}
          className="space-y-4"
        >
          <label>
            <span>Titre</span>
            <input
              required
              minLength={2}
              maxLength={160}
              value={draft.title}
              onChange={(event) =>
                setDraft({ ...draft, title: event.target.value })
              }
            />
          </label>
          <label>
            <span>Sous-titre</span>
            <input
              required
              minLength={2}
              maxLength={200}
              value={draft.subtitle}
              onChange={(event) =>
                setDraft({ ...draft, subtitle: event.target.value })
              }
            />
          </label>
          <label>
            <span>Téléphones</span>
            <input
              required
              minLength={2}
              maxLength={120}
              value={draft.phones}
              onChange={(event) =>
                setDraft({ ...draft, phones: event.target.value })
              }
            />
          </label>
          <label>
            <span>Message de remerciement</span>
            <input
              required
              minLength={2}
              maxLength={200}
              value={draft.thankYouText}
              onChange={(event) =>
                setDraft({ ...draft, thankYouText: event.target.value })
              }
            />
          </label>
          <label>
            <span>Conditions de retour</span>
            <textarea
              required
              minLength={2}
              maxLength={300}
              rows={3}
              value={draft.returnPolicy}
              onChange={(event) =>
                setDraft({ ...draft, returnPolicy: event.target.value })
              }
            />
          </label>
        </fieldset>
        {mutation.isError &&
          (!(mutation.error instanceof ApiRequestError) ||
            mutation.error.status !== 499) && (
            <p role="alert" className={ui("form-error")}>
              {mutation.error instanceof ApiRequestError
                ? mutation.error.message
                : "Enregistrement impossible."}
            </p>
          )}
        {saved && (
          <p role="status" className={ui("form-success")}>
            Les paramètres de facture ont été enregistrés.
          </p>
        )}
        <button
          className={`${ui("primary-button")} mt-4`}
          disabled={settings.isLoading || mutation.isPending}
        >
          <Save size={16} />
          {mutation.isPending ? "Enregistrement…" : "Enregistrer"}
        </button>
      </form>

      <aside className={`${ui("panel")} p-0!`}>
        <div className="border-b border-line bg-brand-soft/60 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <strong className="block text-lg text-brand">
                {draft.title || "Titre de la marque"}
              </strong>
              <span className="mt-1 block text-xs text-muted">
                {draft.subtitle || "Sous-titre"}
              </span>
              <span className="mt-2 block text-xs font-semibold">
                {draft.phones || "Téléphones"}
              </span>
            </div>
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-brand shadow-sm dark:bg-[#352f34]">
              <ReceiptText size={19} />
            </span>
          </div>
        </div>
        <div className="space-y-2 p-5 text-center">
          <strong className="block text-sm text-brand">
            {draft.thankYouText || "Message de remerciement"}
          </strong>
          <p className="text-xs italic text-muted">
            {draft.returnPolicy || "Conditions de retour"}
          </p>
          <small className="block pt-3 text-[10px] text-muted">
            Aperçu du pied de facture
          </small>
        </div>
      </aside>
    </div>
  );
}
