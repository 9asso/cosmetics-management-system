import { useState } from "react";
import type { ProductMediaInput } from "@cosmetics/contracts";
import { api } from "../lib/api";
import { ui } from "../lib/ui";
import { resolveMediaUrl } from "../lib/media";

export function ProductMediaEditor({
  value,
  onChange,
  disabled = false,
  onBusyChange,
}: {
  value: ProductMediaInput;
  onChange: (value: ProductMediaInput) => void;
  disabled?: boolean;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");
  async function upload(files: File[], kind: "image" | "video") {
    if (!files.length || busy || disabled) return;
    setError("");
    if (kind === "image" && value.images.length + files.length > 10) {
      setError("La galerie accepte 10 images maximum.");
      return;
    }
    if (
      files.some(
        (file) =>
          !(
            kind === "image"
              ? ["image/jpeg", "image/png", "image/webp"]
              : ["video/mp4", "video/webm"]
          ).includes(file.type) ||
          file.size > (kind === "image" ? 5 : 30) * 1024 * 1024,
      )
    ) {
      setError(
        kind === "image"
          ? "Utilisez JPG, PNG ou WebP, 5 Mo maximum par image."
          : "Utilisez MP4 ou WebM, 30 Mo maximum.",
      );
      return;
    }
    setBusy(true);
    onBusyChange?.(true);
    let next = value;
    try {
      for (const [index, file] of files.entries()) {
        setProgress(`Envoi ${index + 1}/${files.length} : ${file.name}`);
        const asset = await api.uploadProductMedia(file);
        if (asset.type !== kind)
          throw new Error(
            "Le contenu du fichier ne correspond pas au type attendu.",
          );
        next =
          kind === "image"
            ? { ...next, images: [...next.images, asset.url] }
            : { ...next, videoUrl: asset.url };
        onChange(next);
      }
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Envoi impossible. Réessayez.",
      );
    } finally {
      setBusy(false);
      onBusyChange?.(false);
      setProgress("");
    }
  }
  const locked = busy || disabled;
  return (
    <fieldset
      disabled={locked}
      className="my-4 rounded-xl border border-line bg-surface p-4"
    >
      <legend className="px-2 text-sm font-bold">Galerie & vidéo</legend>
      <p className="mb-3 text-xs text-muted">
        Jusqu’à 10 images et une vidéo. L’image à la une apparaît dans le
        catalogue et la boutique.
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {value.images.map((url, index) => (
          <div
            key={url}
            className="rounded-xl border border-line bg-white p-2 dark:bg-[#302b2f]"
          >
            <img
              src={resolveMediaUrl(url)}
              alt={`Image ${index + 1}`}
              className="h-24 w-full rounded-lg object-contain"
            />
            <button
              type="button"
              aria-pressed={index === 0}
              className="mt-2 w-full rounded-md bg-brand-soft p-1.5 text-[10px] font-bold text-brand"
              onClick={() =>
                onChange({
                  ...value,
                  images: [
                    url,
                    ...value.images.filter((image) => image !== url),
                  ],
                })
              }
            >
              {index === 0 ? "★ À la une" : "Mettre à la une"}
            </button>
            <button
              type="button"
              aria-label={`Retirer l’image ${index + 1}`}
              className="mt-1 w-full p-1 text-[10px] text-muted"
              onClick={() =>
                onChange({
                  ...value,
                  images: value.images.filter((image) => image !== url),
                })
              }
            >
              Retirer
            </button>
          </div>
        ))}
      </div>
      <label className="mt-3 block text-xs font-semibold">
        Ajouter des images (5 Mo chacune)
        <input
          className="mt-2 block w-full text-xs"
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          disabled={locked || value.images.length >= 10}
          onChange={(event) => {
            void upload(Array.from(event.target.files ?? []), "image");
            event.target.value = "";
          }}
        />
      </label>
      {value.videoUrl && (
        <div className="mt-4">
          <video
            key={value.videoUrl}
            src={resolveMediaUrl(value.videoUrl)}
            controls
            preload="metadata"
            className="max-h-52 w-full rounded-lg bg-black"
          />
          <button
            type="button"
            className="mt-2 text-xs text-muted"
            onClick={() => onChange({ ...value, videoUrl: "" })}
          >
            Retirer la vidéo
          </button>
        </div>
      )}
      <label className="mt-4 block text-xs font-semibold">
        {value.videoUrl ? "Remplacer la vidéo" : "Ajouter une vidéo"} (MP4 /
        WebM · 30 Mo)
        <input
          className="mt-2 block w-full text-xs"
          type="file"
          accept="video/mp4,video/webm"
          onChange={(event) => {
            void upload(
              Array.from(event.target.files ?? []).slice(0, 1),
              "video",
            );
            event.target.value = "";
          }}
        />
      </label>
      {busy && (
        <p role="status" className="mt-3 text-xs text-brand">
          {progress}
        </p>
      )}
      {error && (
        <p role="alert" className={ui("form-error")}>
          {error}
        </p>
      )}
    </fieldset>
  );
}
