// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ProductListItem } from "@cosmetics/contracts";
import { InventoryPage } from "./InventoryPage";
import { api, ApiRequestError } from "../lib/api";

vi.mock("../lib/api", () => ({
  ApiRequestError: class extends Error {
    constructor(
      message: string,
      public readonly status: number,
      public readonly details?: unknown,
    ) {
      super(message);
    }
  },
  api: {
    products: vi.fn(),
    productConflicts: vi.fn(),
    suppliers: vi.fn(),
    createProduct: vi.fn(),
    updateProduct: vi.fn(),
    deleteProduct: vi.fn(),
    adjustInventory: vi.fn(),
    uploadProductMedia: vi.fn(),
    updateProductMedia: vi.fn(),
    productStockLots: vi.fn(),
    updateStockLot: vi.fn(),
  },
}));

const product: ProductListItem = {
  id: "10000000-0000-4000-8000-000000000001",
  variantId: "20000000-0000-4000-8000-000000000001",
  name: "Sérum test",
  brand: "ONight",
  category: "SKIN_CARE",
  subcategory: "Sérums & traitements",
  description: "",
  imageUrl: "",
  images: [],
  videoUrl: "",
  sourceUrl: "",
  sku: "SERUM-TEST",
  barcode: "",
  reference: "",
  supplierName: "",
  purchasePrice: 50,
  wholesalePrice: 80,
  retailPrice: 100,
  compareAtPrice: null,
  onHand: 4,
  reserved: 0,
  available: 4,
  lowStockThreshold: 5,
  retailVisible: false,
};

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

function mount(canDelete: boolean) {
  vi.mocked(api.products).mockResolvedValue({
    items: [product],
    total: 1,
    page: 1,
    pageSize: 50,
  });
  vi.mocked(api.suppliers).mockResolvedValue([]);
  vi.mocked(api.productConflicts).mockResolvedValue([]);
  vi.mocked(api.deleteProduct).mockResolvedValue({ deleted: true });
  vi.mocked(api.updateProduct).mockResolvedValue(product);
  vi.mocked(api.productStockLots).mockResolvedValue([]);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <InventoryPage canManage canDelete={canDelete} />
    </QueryClientProvider>,
  );
  return client;
}

describe("product deletion", () => {
  it("shows the matching product and opens it directly for editing after a duplicate barcode", async () => {
    const duplicate = { ...product, barcode: "6110000000012" };
    vi.mocked(api.createProduct).mockRejectedValue(
      new ApiRequestError("SKU or barcode already exists", 409),
    );
    const client = mount(true);
    vi.mocked(api.productConflicts).mockResolvedValue([duplicate]);

    fireEvent.click(
      await screen.findByRole("button", { name: /Nouveau produit/ }),
    );
    fireEvent.change(screen.getByLabelText("Nom du produit"), {
      target: { value: "Nouveau sérum" },
    });
    fireEvent.change(screen.getByLabelText("Marque"), {
      target: { value: "ONight" },
    });
    fireEvent.change(screen.getByLabelText("Code-barres"), {
      target: { value: duplicate.barcode },
    });
    fireEvent.change(screen.getByLabelText("Référence"), {
      target: { value: "REF-NOUVEAU-SERUM" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Ajouter le produit" }));

    await waitFor(() =>
      expect(api.createProduct).toHaveBeenCalledWith(
        expect.objectContaining({ reference: "REF-NOUVEAU-SERUM" }),
        expect.anything(),
      ),
    );
    expect(
      await screen.findByText("SKU ou code-barres déjà utilisé."),
    ).toBeTruthy();
    expect(await screen.findByText("Même code-barres")).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: `Modifier ${duplicate.name}` }),
    );

    expect(
      await screen.findByRole("dialog", { name: "Fiche produit" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Enregistrer le produit" }),
    ).toBeTruthy();
    client.clear();
  });

  it("asks an admin to confirm before deleting", async () => {
    const client = mount(true);
    fireEvent.click(await screen.findByRole("button", { name: "Supprimer" }));
    const dialog = screen.getByRole("dialog", {
      name: "Supprimer le produit",
    });
    expect(dialog).toBeTruthy();
    expect(within(dialog).getByText(/Sérum test/)).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", { name: "Confirmer la suppression" }),
    );
    await waitFor(() =>
      expect(api.deleteProduct).toHaveBeenCalledWith(product.id),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Supprimer le produit" }),
      ).toBeNull(),
    );
    client.clear();
  });

  it("does not show deletion to non-admin stock managers", async () => {
    const client = mount(false);
    expect(await screen.findByText("Sérum test")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Supprimer" })).toBeNull();
    client.clear();
  });

  it("edits the product details from its product sheet", async () => {
    const client = mount(true);
    fireEvent.click(await screen.findByText("Sérum test"));
    fireEvent.click(
      await screen.findByRole("button", { name: "Modifier le produit" }),
    );
    fireEvent.change(screen.getByLabelText("Nom"), {
      target: { value: "Sérum modifié" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Enregistrer le produit" }),
    );

    await waitFor(() =>
      expect(api.updateProduct).toHaveBeenCalledWith(
        product.id,
        expect.objectContaining({ name: "Sérum modifié", sku: product.sku }),
      ),
    );
    client.clear();
  });
});
