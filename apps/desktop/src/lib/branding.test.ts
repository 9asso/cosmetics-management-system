import { describe, expect, it } from "vitest";
import { brandNameForRole, invoiceBrandSettings } from "./branding";

describe("role-based branding", () => {
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
      title: "Yamoura DISTRIBUTEUR",
      subtitle: "Facture Yamoura",
      phones: "Contact Yamoura",
      thankYouText: "Merci, Yamoura",
      returnPolicy: "Retour chez Yamoura",
    });
  });
});
