// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DashboardPage } from "./DashboardPage";
vi.mock("../lib/api", () => ({
  ApiRequestError: class extends Error {},
  api: {
    dashboard: async () => ({
      lowStockCount: 2,
      outOfStockCount: 1,
      pendingChecks: 1,
      inventoryValue: 50,
      unitsInStock: 5,
      customerReceivables: 30,
      supplierPayables: 20,
    }),
    analytics: async () => ({
      periods: [],
      activity: [],
      grain: "day",
      generatedAt: new Date().toISOString(),
    }),
  },
}));
vi.mock("recharts", () => ({
  ResponsiveContainer: () => null,
  LineChart: () => null,
  CartesianGrid: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  Line: () => null,
  ReferenceArea: () => null,
  ReferenceDot: () => null,
}));
afterEach(cleanup);
describe("actionable dashboard navigation", () => {
  it("opens stock filters, check register and the product form directly", async () => {
    const navigate = vi.fn();
    const client = new QueryClient();
    render(
      <QueryClientProvider client={client}>
        <DashboardPage role="OWNER" onNavigate={navigate} />
      </QueryClientProvider>,
    );
    fireEvent.click(
      await screen.findByRole("button", { name: /Stock faible/ }),
    );
    expect(navigate).toHaveBeenLastCalledWith("inventory", { stock: "low" });
    fireEvent.click(screen.getByRole("button", { name: /Ruptures de stock/ }));
    expect(navigate).toHaveBeenLastCalledWith("inventory", { stock: "out" });
    fireEvent.click(screen.getByRole("button", { name: /Chèques en attente/ }));
    expect(navigate).toHaveBeenLastCalledWith("finance", {
      financeTab: "checks",
    });
    fireEvent.click(screen.getByRole("button", { name: /Ajouter un produit/ }));
    expect(navigate).toHaveBeenLastCalledWith("inventory", {
      createProduct: true,
    });
    client.clear();
  });
  it("does not offer finance or management actions to staff", async () => {
    const client = new QueryClient();
    render(
      <QueryClientProvider client={client}>
        <DashboardPage role="STAFF" onNavigate={() => {}} />
      </QueryClientProvider>,
    );
    expect(
      await screen.findByRole("button", { name: /Suivre les commandes/ }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", {
        name: /Ajouter un produit|Nouvelle vente|Nouvel achat|Chèques en attente|Factures à encaisser/,
      }),
    ).toBeNull();
    client.clear();
  });
});
