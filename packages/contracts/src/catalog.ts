import { z } from "zod";
import { moneySchema, paginationQuerySchema } from "./shared.js";

export const productCategories = [
  "BATH_BODY",
  "HAIR",
  "SUPPLEMENTS",
  "HYGIENE",
  "MAKEUP",
  "FRAGRANCE",
  "SKIN_CARE",
  "ORAL_CARE",
] as const;

export const productTaxonomy = {
  BATH_BODY: { label: "Bath & Body", subcategories: ["Corps", "Douche & bain", "Hydratation corps"] },
  HAIR: { label: "Cheveux", subcategories: ["Appareils & coiffage", "Huiles & traitements", "Masques & traitements", "Parfums & finitions cheveux", "Soin des cheveux", "Sérums & traitements"] },
  SUPPLEMENTS: { label: "Compléments alimentaires", subcategories: ["Acides aminés & antioxydants", "Autres compléments", "Collagène", "Minéraux", "Oméga & acides gras", "Plantes & extraits", "Probiotiques", "Vitamines"] },
  HYGIENE: { label: "Hygiène", subcategories: ["Déodorants", "Déodorants & anti-transpirants", "Hygiène intime"] },
  MAKEUP: { label: "Maquillage", subcategories: ["Accessoires", "Coffrets & kits", "Lèvres", "Lèvres & Joues", "Sourcils", "Visage", "Yeux"] },
  FRAGRANCE: { label: "Parfum", subcategories: ["Brumes parfumées", "Coffrets", "Eau de parfum", "Eau de toilette", "Parfum", "Parfums", "Recharges", "Testeurs"] },
  SKIN_CARE: { label: "Skin care", subcategories: ["Anti-âge", "Autres soins visage", "Brumes visage", "Coffrets & routines", "Contour des yeux", "Exfoliants", "Hydratants", "Masques", "Nettoyants", "Protection solaire", "Soin cils & sourcils", "Sérums & traitements", "Toners & essences"] },
  ORAL_CARE: { label: "Soin dentaire", subcategories: ["Bains de bouche", "Blanchiment dentaire", "Dentifrices & soins"] },
} as const;

export const productCategorySchema = z.enum(productCategories);

// Only render safe public media addresses; no executable or inline data URLs.
export const mediaUrlSchema = z
  .string()
  .trim()
  .max(2000)
  .refine((value) => {
    if (/^\/(?!\/)[^\\\s]*$/.test(value)) return true;
    try {
      const url = new URL(value);
      return (
        ["https:", "http:"].includes(url.protocol) &&
        !url.username &&
        !url.password
      );
    } catch {
      return false;
    }
  }, "Adresse de média invalide.");
export const productMediaSchema = z.object({
  images: z
    .array(mediaUrlSchema)
    .max(10)
    .refine(
      (items) => new Set(items).size === items.length,
      "Images dupliquées.",
    ),
  videoUrl: z.union([z.literal(""), mediaUrlSchema]).default(""),
});
export type ProductMediaInput = z.infer<typeof productMediaSchema>;

export const createProductSchema = z.object({
  name: z.string().trim().min(2).max(160),
  brand: z.string().trim().min(1).max(100),
  category: productCategorySchema.default("SKIN_CARE"),
  subcategory: z.string().trim().max(100).default(""),
  description: z.string().trim().max(2_000).default(""),
  imageUrl: z.union([z.literal(""), mediaUrlSchema]).default(""),
  sourceUrl: z.string().trim().max(2_000).default(""),
  sku: z.string().trim().min(1).max(80),
  barcode: z.string().trim().max(80).default(""),
  reference: z.string().trim().max(100).default(""),
  supplierName: z.string().trim().max(160).default(""),
  supplierId: z.string().uuid().optional(),
  media: productMediaSchema.optional(),
  imageUpload: z.object({ data: z.string().min(4).max(7_000_000) }).optional(),
  purchasePrice: moneySchema,
  wholesalePrice: moneySchema,
  retailPrice: moneySchema,
  compareAtPrice: moneySchema.optional(),
  initialQuantity: z.coerce.number().int().min(0).max(999_999).default(0),
  lowStockThreshold: z.coerce.number().int().min(0).max(999_999).default(5),
  retailVisible: z.boolean().default(false),
}).superRefine((product, context) => {
  const allowed = productTaxonomy[product.category].subcategories as readonly string[];
  if (product.subcategory && !allowed.includes(product.subcategory))
    context.addIssue({ code: "custom", path: ["subcategory"], message: "Sous-catégorie invalide pour cette catégorie." });
});

export type CreateProductInput = z.infer<typeof createProductSchema>;

export const productListQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(160).default(""),
  category: productCategorySchema.optional(),
  subcategory: z.string().trim().max(100).optional(),
  stock: z.enum(["all", "low", "out"]).default("all"),
});

export type ProductListQuery = z.infer<typeof productListQuerySchema>;

export interface ProductListItem {
  id: string;
  variantId: string;
  name: string;
  brand: string;
  category: (typeof productCategories)[number];
  subcategory: string;
  description: string;
  imageUrl: string;
  images?: string[];
  videoUrl?: string;
  sourceUrl: string;
  sku: string;
  barcode: string;
  reference: string;
  supplierName: string;
  purchasePrice: number;
  wholesalePrice: number;
  retailPrice: number;
  compareAtPrice: number | null;
  onHand: number;
  reserved: number;
  available: number;
  lowStockThreshold: number;
  retailVisible: boolean;
}

export interface ProductStockLot {
  id: string;
  source: string;
  supplierName: string;
  receivedOn: string;
  receivedQuantity: number;
  remainingQuantity: number;
  purchasePrice: number;
  wholesalePrice: number;
  retailPrice: number;
}

export const updateStockLotSchema = z.object({
  wholesalePrice: z.number().nonnegative("Le prix grossiste doit être positif ou nul."),
  retailPrice: z.number().nonnegative("Le prix boutique doit être positif ou nul."),
});

export type UpdateStockLotInput = z.infer<typeof updateStockLotSchema>;

