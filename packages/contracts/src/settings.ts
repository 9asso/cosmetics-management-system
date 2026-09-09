import { z } from "zod";

export const brandSettingsSchema = z.object({
  title: z.string().trim().min(2).max(160),
  subtitle: z.string().trim().min(2).max(200),
  phones: z.string().trim().min(2).max(120),
  thankYouText: z.string().trim().min(2).max(200),
  returnPolicy: z.string().trim().min(2).max(300),
});

export type BrandSettings = z.infer<typeof brandSettingsSchema>;

export const defaultBrandSettings: BrandSettings = {
  title: "O'NIGHT DISTRIBUTEUR",
  subtitle: "Distributeur Cosmetiques & Beaute",
  phones: "076385494 | 0661754055",
  thankYouText: "Merci de votre confiance !",
  returnPolicy: "Les articles ne sont ni repris ni echanges sans ticket.",
};
