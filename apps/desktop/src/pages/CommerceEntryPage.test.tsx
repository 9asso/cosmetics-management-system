// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CommerceEntryPage } from "./CommerceEntryPage";
import { api } from "../lib/api";
import type { ProductListItem } from "@cosmetics/contracts";
vi.mock("../lib/api", () => ({
  ApiRequestError: class extends Error {},
  api: {
    customers: vi.fn(),
    suppliers: vi.fn(),
    products: vi.fn(),
    createPurchase: vi.fn(),
    createWholesaleSale: vi.fn(),
  },
}));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
const products = [
  {
    variantId: "a",
    name: "Serum",
    sku: "SERUM",
    available: 20,
    purchasePrice: 10,
    wholesalePrice: 20,
  },
  {
    variantId: "b",
    name: "Lipstick",
    sku: "LIP",
    available: 5,
    purchasePrice: 5,
    wholesalePrice: 15,
  },
] as ProductListItem[];
function mount(kind: "sale" | "purchase") {
  const partners = [
    { id: "partner", name: "QA partner", phone: "", email: "", address: "" },
  ];
  vi.mocked(api.customers).mockResolvedValue(partners);
  vi.mocked(api.suppliers).mockResolvedValue(partners);
  vi.mocked(api.products).mockResolvedValue({
    items: products,
    total: 26,
    page: 1,
    pageSize: 25,
  });
  vi.mocked(api.createPurchase).mockResolvedValue({
    id: "doc",
    documentNumber: "ACH-QA",
    status: "RECEIVED",
    total: 20,
  });
  vi.mocked(api.createWholesaleSale).mockResolvedValue({
    id: "doc",
    documentNumber: "FAC-QA",
    status: "CONFIRMED",
    total: 55,
  });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <CommerceEntryPage kind={kind} />
    </QueryClientProvider>,
  );
  return client;
}
describe("multi-product commerce entry", () => {
  it.each(["sale", "purchase"] as const)(
    "submits all %s lines with quantities and prices, merging repeated selections",
    async (kind) => {
      const client = mount(kind);
      await screen.findByRole("option", { name: "QA partner" });
      fireEvent.change(
        screen.getByLabelText(
          kind === "sale" ? "Client grossiste" : "Fournisseur",
        ),
        { target: { value: "partner" } },
      );
      for (const id of ["a", "a", "b"]) {
        fireEvent.change(screen.getByLabelText("Produit à ajouter"), {
          target: { value: id },
        });
        fireEvent.click(
          screen.getByRole("button", { name: "Ajouter la ligne" }),
        );
      }
      expect(
        (screen.getByLabelText("Quantité · SERUM") as HTMLInputElement).value,
      ).toBe("2");
      fireEvent.click(
        screen.getByRole("button", {
          name: kind === "sale" ? "Créer la vente" : "Valider la réception",
        }),
      );
      const method =
        kind === "sale" ? api.createWholesaleSale : api.createPurchase;
      await waitFor(() =>
        expect(method).toHaveBeenCalledWith(
          expect.objectContaining({
            items: [
              {
                variantId: "a",
                quantity: 2,
                [kind === "sale" ? "unitPrice" : "unitCost"]:
                  kind === "sale" ? 20 : 10,
              },
              {
                variantId: "b",
                quantity: 1,
                [kind === "sale" ? "unitPrice" : "unitCost"]:
                  kind === "sale" ? 15 : 5,
              },
            ],
          }),
        ),
      );
      expect(
        await screen.findByRole("button", { name: "Voir la facture" }),
      ).toBeTruthy();
      expect(screen.queryByLabelText("Quantité · SERUM")).toBeNull();
      client.clear();
    },
  );
  it("searches beyond the first catalog page while preserving the cart", async () => {
    const client = mount("sale");
    await screen.findByRole("option", { name: "QA partner" });
    fireEvent.change(screen.getByLabelText("Produit à ajouter"), {
      target: { value: "a" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Ajouter la ligne" }));
    fireEvent.click(screen.getByRole("button", { name: "Suivant" }));
    await waitFor(() =>
      expect(api.products).toHaveBeenCalledWith(
        expect.objectContaining({ page: 2 }),
      ),
    );
    fireEvent.change(screen.getByLabelText("Rechercher un produit"), {
      target: { value: "barcode-123" },
    });
    await waitFor(() =>
      expect(api.products).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1, search: "barcode-123" }),
      ),
    );
    expect(screen.getByLabelText("Quantité · SERUM")).toBeTruthy();
    client.clear();
  });
});
