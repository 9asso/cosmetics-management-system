import type { BrandSettings, UserRole } from "@cosmetics/contracts";
import { defaultBrandSettings } from "./brand-settings";

export const primaryBrandName = "ONight";
export const restrictedBrandName = "Yamoura";
/** Commercial restreint invoices show this tagline and WhatsApp line instead of the company's. */
export const salesRepSubtitle = "Beauty and Luxury";
export const salesRepWhatsapp = "06 66 54 07 50";

const onightPattern = /o(?:['’\s-]?night)/gi;

export function brandNameForRole(role?: UserRole | null) {
  return role === "SALES_REP" || role === "STOREFRONT_MANAGER" ? restrictedBrandName : primaryBrandName;
}

export function replaceRestrictedBrand(value: string) {
  return value.replace(onightPattern, restrictedBrandName);
}

export function invoiceBrandSettings(
  settings: BrandSettings | undefined,
  restricted: boolean,
  salesRep = false,
): BrandSettings {
  const source = settings ?? defaultBrandSettings;
  if (!restricted) return source;
  return {
    title: restrictedBrandName,
    subtitle: salesRep ? salesRepSubtitle : "",
    phones: salesRep ? salesRepWhatsapp : replaceRestrictedBrand(source.phones),
    thankYouText: replaceRestrictedBrand(source.thankYouText),
    returnPolicy: replaceRestrictedBrand(source.returnPolicy),
  };
}
