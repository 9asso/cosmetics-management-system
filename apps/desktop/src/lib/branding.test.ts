import { describe, expect, it } from "vitest";
import { defaultBrandSettings } from "./brand-settings";
import { brandNameForRole, invoiceBrandSettings } from "./branding";

describe("role-based branding", () => {
  it("shows only the WhatsApp number on Commercial restreint invoices", () => {
    const settings = invoiceBrandSettings(defaultBrandSettings, true, true);
    expect(settings.phones).toBe("06 66 54 07 50");
    expect(settings.subtitle).toBe("Beauty and Luxury");
    expect(invoiceBrandSettings(defaultBrandSettings, true).phones).toBe(
      defaultBrandSettings.phones,
    );
  });

  it("uses Yamoura only for the restricted commercial role", () => {
    expect(brandNameForRole("SALES_REP")).toBe("Yamoura");
    expect(brandNameForRole("OWNER")).toBe("ONight");
  });

  it("replaces every ONight spelling in restricted invoice settings", () => {
    expect(
      invoiceBrandSettings(
        {
          title: "O'NIGHT DISTRIBUTEUR",
          subtitle: "Facture ONight",
          phones: "Contact O-Night",
          thankYouText: "Merci, O Night",
          returnPolicy: "Retour chez ONIGHT",
        },
        true,
      ),
    ).toEqual({
      title: "Yamoura",
      subtitle: "",
      phones: "Contact Yamoura",
      thankYouText: "Merci, Yamoura",
      returnPolicy: "Retour chez Yamoura",
    });
  });
});
