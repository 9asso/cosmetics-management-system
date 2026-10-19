// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultStorefrontSettings } from "@cosmetics/contracts";
import { defaultBrandSettings } from "../lib/brand-settings";
import { api } from "../lib/api";
import { SettingsPage } from "./SettingsPage";

vi.mock("../lib/api", () => ({
  ApiRequestError: class extends Error {},
  api: {
    brandSettings: vi.fn(),
    updateBrandSettings: vi.fn(),
    storefrontSettings: vi.fn(),
    updateStorefrontSettings: vi.fn(),
    discountCodes: vi.fn(),
    createDiscountCode: vi.fn(),
    updateDiscountCode: vi.fn(),
    deleteDiscountCode: vi.fn(),
  },
}));

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

function renderPage() {
  vi.mocked(api.storefrontSettings).mockResolvedValue(defaultStorefrontSettings);
  vi.mocked(api.discountCodes).mockResolvedValue([]);
  vi.mocked(api.brandSettings).mockResolvedValue(defaultBrandSettings);
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  render(
    <QueryClientProvider client={client}>
      <SettingsPage />
    </QueryClientProvider>,
  );
  return client;
}

describe("storefront settings", () => {
  it("switches to every product in stock and saves the delivery amounts", async () => {
    vi.mocked(api.updateStorefrontSettings).mockImplementation(
      async (value) => value,
    );
    const client = renderPage();
    const threshold = (await screen.findByLabelText(
      "Livraison offerte dès (MAD)",
    )) as HTMLInputElement;
    await waitFor(() => expect(threshold.disabled).toBe(false));
    expect(threshold.value).toBe("500");
    fireEvent.click(
      screen.getByRole("radio", { name: /Tous les produits en stock/ }),
    );
    fireEvent.change(threshold, { target: { value: "1000" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() =>
      expect(api.updateStorefrontSettings).toHaveBeenCalledWith({
        ...defaultStorefrontSettings,
        productScope: "IN_STOCK",
        freeShippingThreshold: 1000,
      }),
    );
    expect(
      await screen.findByText("La boutique en ligne a été mise à jour."),
    ).toBeTruthy();
    client.clear();
  });

  it("disables the product rule while the demo catalogue is shown", async () => {
    const client = renderPage();
    const threshold = (await screen.findByLabelText(
      "Livraison offerte dès (MAD)",
    )) as HTMLInputElement;
    await waitFor(() => expect(threshold.disabled).toBe(false));
    fireEvent.click(
      screen.getByRole("radio", { name: /Produits de démonstration/ }),
    );
    expect(
      (
        screen.getByRole("radio", {
          name: /Tous les produits en stock/,
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(screen.getByText("Mode démo")).toBeTruthy();
    client.clear();
  });
});

describe("discount codes", () => {
  it("creates a percentage code from the modal", async () => {
    vi.mocked(api.createDiscountCode).mockImplementation(async (value) => ({
      ...value,
      id: "code-1",
      usageCount: 0,
      createdAt: "2026-10-19T10:00:00Z",
    }));
    const client = renderPage();
    fireEvent.click(screen.getByRole("tab", { name: /Codes de réduction/ }));
    expect(await screen.findByText("Aucun code de réduction")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Nouveau code/ }));
    fireEvent.change(screen.getByPlaceholderText("BIENVENUE10"), {
      target: { value: "ete25" },
    });
    fireEvent.change(screen.getByLabelText("Réduction (%)"), {
      target: { value: "25" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Créer le code" }));
    await waitFor(() =>
      expect(api.createDiscountCode).toHaveBeenCalledWith({
        code: "ETE25",
        type: "PERCENT",
        value: 25,
        minSubtotal: 0,
        expiresOn: null,
        active: true,
      }),
    );
    client.clear();
  });
});

describe("invoice brand settings", () => {
  it("loads, previews and saves the editable invoice details", async () => {
    vi.mocked(api.updateBrandSettings).mockImplementation(
      async (value) => value,
    );
    const client = renderPage();
    fireEvent.click(screen.getByRole("tab", { name: /Facture/ }));

    const title = (await screen.findByLabelText("Titre")) as HTMLInputElement;
    await waitFor(() => expect(title.disabled).toBe(false));
    expect(title.value).toBe("O'NIGHT DISTRIBUTEUR");
    fireEvent.change(screen.getByLabelText("Téléphones"), {
      target: { value: "0600000000 | 0700000000" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() =>
      expect(api.updateBrandSettings).toHaveBeenCalledWith({
        ...defaultBrandSettings,
        phones: "0600000000 | 0700000000",
      }),
    );
    expect(
      await screen.findByText("Les paramètres de facture ont été enregistrés."),
    ).toBeTruthy();
    client.clear();
  });
});
