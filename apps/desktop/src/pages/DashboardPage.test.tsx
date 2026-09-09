// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DashboardPage } from "./DashboardPage";
import { api } from "../lib/api";
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
      incomeReceived: 90,
      ordersToProcess: 3,
      reservedUnits: 7,
      dueChecks: 1,
    }),
    analytics: async () => ({
      periods: [],
      activity: [],
      products: {
        recentPurchases: [
          {
            id: "purchase-line",
            productId: "product",
            variantId: "variant",
            name: "Crème achetée récemment",
            brand: "ONight",
            sku: "CREME-1",
            imageUrl: "/cream.webp",
            quantity: 12,
            amount: 240,
            partnerName: "Fournisseur beauté",
            documentNumber: "ACH-1",
            occurredAt: "2026-09-09T10:00:00Z",
            channel: "PURCHASE",
          },
        ],
        recentSales: [
          {
            id: "sale-line",
            productId: "product",
            variantId: "variant",
            name: "Crème vendue récemment",
            brand: "ONight",
            sku: "CREME-1",
            imageUrl: "/cream.webp",
            quantity: 3,
            amount: 120,
            partnerName: "Client beauté",
            documentNumber: "FAC-1",
            occurredAt: "2026-09-09T11:00:00Z",
            channel: "WHOLESALE",
          },
        ],
        topWholesale: [
          {
            productId: "product",
            variantId: "variant",
            name: "Top crème grossiste",
            brand: "ONight",
            sku: "CREME-1",
            imageUrl: "/cream.webp",
            unitsSold: 20,
            revenue: 800,
            orderCount: 4,
          },
        ],
        topRetail: [
          {
            productId: "retail-product",
            variantId: "retail-variant",
            name: "Top crème boutique",
            brand: "ONight",
            sku: "CREME-2",
            imageUrl: "",
            unitsSold: 8,
            revenue: 480,
            orderCount: 6,
          },
        ],
      },
      customers: {
        topWholesale: [
          {
            customerId: "wholesale-client",
            name: "Grossiste numéro un",
            city: "Casablanca",
            revenue: 1500,
            orderCount: 3,
            unitsBought: 40,
          },
        ],
        topRetail: [
          {
            customerId: "retail-client",
            name: "Cliente boutique numéro un",
            city: "Rabat",
            revenue: 500,
            orderCount: 2,
            unitsBought: 5,
          },
        ],
        topCities: [
          {
            city: "Casablanca",
            revenue: 1800,
            orderCount: 4,
            customerCount: 2,
          },
        ],
      },
      grain: "day",
      generatedAt: new Date().toISOString(),
    }),
    dashboardReport: vi.fn(async (dateFrom: string, dateTo: string) => ({
      dateFrom,
      dateTo,
      generatedAt: new Date().toISOString(),
      salesRevenue: 100,
      grossMargin: 40,
      incomeReceived: 80,
      customerRefunds: 5,
      purchases: 25,
      supplierPayments: 20,
      expenses: 10,
      netCash: 45,
      salesCount: 2,
      unitsSold: 8,
      purchaseCount: 1,
      expenseCount: 1,
      periods: [
        {
          period: "2026-09-09",
          salesRevenue: 100,
          grossMargin: 40,
          incomeReceived: 80,
          cashOut: 35,
        },
      ],
      documents: [],
    })),
  },
}));
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => children,
  ComposedChart: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  Bar: ({ dataKey }: { dataKey: string }) => (
    <span data-testid={`chart-bar-${dataKey}`} />
  ),
  CartesianGrid: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  Line: () => null,
}));
afterEach(cleanup);
describe("actionable dashboard navigation", () => {
  it("opens every alert destination directly", async () => {
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
    fireEvent.click(
      screen.getByRole("button", { name: /Commandes boutique à traiter/ }),
    );
    expect(navigate).toHaveBeenLastCalledWith("orders");
    fireEvent.click(screen.getByRole("button", { name: /Stock réservé/ }));
    expect(navigate).toHaveBeenLastCalledWith("inventory");
    fireEvent.click(
      screen.getByRole("button", { name: /Chèques arrivés à échéance/ }),
    );
    expect(navigate).toHaveBeenLastCalledWith("finance", {
      financeTab: "checks",
    });
    expect(screen.queryByText("Actions rapides")).toBeNull();
    expect(screen.queryByText("Activité récente")).toBeNull();
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
      await screen.findByRole("button", {
        name: /Commandes boutique à traiter/,
      }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", {
        name: /Chèques en attente|Chèques arrivés à échéance|Factures à encaisser/,
      }),
    ).toBeNull();
    client.clear();
  });
  it("shows a printable report for a selected date range", async () => {
    const client = new QueryClient();
    render(
      <QueryClientProvider client={client}>
        <DashboardPage
          role="ACCOUNTANT"
          onNavigate={() => {}}
          reportOpen
          onReportClose={() => {}}
        />
      </QueryClientProvider>,
    );
    expect(await screen.findByText("Rapport de performance")).toBeTruthy();
    expect(screen.getByText("Remboursements clients")).toBeTruthy();
    expect(screen.getByLabelText("Date de début")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cette semaine" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Mois dernier" })).toBeTruthy();
    expect(screen.getByLabelText("Mois précédents")).toBeTruthy();
    expect(screen.getByLabelText("Mois suivants")).toBeTruthy();
    expect(screen.getByText("Ventes et marge brute")).toBeTruthy();
    expect(screen.getByText("Flux de trésorerie")).toBeTruthy();
    expect(api.dashboardReport).toHaveBeenCalled();
    client.clear();
  });
  it("shows recent and top products for wholesale and retail", async () => {
    const client = new QueryClient();
    render(
      <QueryClientProvider client={client}>
        <DashboardPage role="OWNER" onNavigate={() => {}} />
      </QueryClientProvider>,
    );
    expect(await screen.findByText("Crème achetée récemment")).toBeTruthy();
    expect(screen.getByText("Crème vendue récemment")).toBeTruthy();
    expect(screen.getByText("Top crème grossiste")).toBeTruthy();
    expect(screen.getByText("Top crème boutique")).toBeTruthy();
    expect(screen.getByText("Grossiste numéro un")).toBeTruthy();
    expect(screen.getByText("Cliente boutique numéro un")).toBeTruthy();
    expect(screen.getAllByText("Casablanca").length).toBeGreaterThan(0);
    expect(screen.getAllByTestId("chart-bar-revenue")).toHaveLength(1);
    expect(screen.queryByTestId("chart-bar-wholesaleRevenue")).toBeNull();
    expect(screen.queryByTestId("chart-bar-retailRevenue")).toBeNull();
    expect(
      document.querySelector('img[src="http://localhost:3000/cream.webp"]'),
    ).toBeTruthy();
    client.clear();
  });
});
