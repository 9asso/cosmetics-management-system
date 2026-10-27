import type { BrandSettings, UserRole } from "@cosmetics/contracts";
import { defaultBrandSettings } from "./brand-settings";

export const primaryBrandName = "ONight";
export const restrictedBrandName = "Yamoura";

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
): BrandSettings {
  const source = settings ?? defaultBrandSettings;
  if (!restricted) return source;
  return {
    title: replaceRestrictedBrand(source.title),
    subtitle: replaceRestrictedBrand(source.subtitle),
    phones: replaceRestrictedBrand(source.phones),
    thankYouText: replaceRestrictedBrand(source.thankYouText),
    returnPolicy: replaceRestrictedBrand(source.returnPolicy),
  };
}
