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
import { api } from "../lib/api";
import { OrdersPage } from "./OrdersPage";

vi.mock("../lib/api", () => ({
  ApiRequestError: class extends Error {},
  api: {
    orders: vi.fn(),
    updateOrderStatus: vi.fn(),
  },
}));

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe("order status actions", () => {
  it("offers only Livrée and Annulée for an open order", async () => {
    vi.mocked(api.orders).mockResolvedValue([
      {
        id: "order",
        orderNumber: "WEB-QA",
        channel: "RETAIL_WEB",
        customerName: "Cliente QA",
        customerPhone: "",
        itemCount: 1,
        totalQuantity: 2,
        grandTotal: 120,
        amountPaid: 0,
        paymentMethod: "COD",
        status: "ORDERED",
        placedAt: "2026-09-09T10:00:00Z",
      },
    ]);
    vi.mocked(api.updateOrderStatus).mockResolvedValue({} as never);
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    render(
      <QueryClientProvider client={client}>
        <OrdersPage />
      </QueryClientProvider>,
    );

    expect(await screen.findByRole("button", { name: "Livrée" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Annulée" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Confirmer" })).toBeNull();
    expect(screen.getByRole("option", { name: "Livrée" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Annulée" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: "Confirmée" })).toBeNull();
    expect(screen.queryByRole("option", { name: "Commandée" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Livrée" }));
    await waitFor(() =>
      expect(api.updateOrderStatus).toHaveBeenCalledWith("order", "DELIVERED"),
    );
    client.clear();
  });

  it("keeps only Annulée for a delivered wholesale invoice", async () => {
    vi.mocked(api.orders).mockResolvedValue([
      {
        id: "invoice",
        orderNumber: "FAC-QA",
        channel: "WHOLESALE_DESKTOP",
        customerName: "Client grossiste",
        customerPhone: "",
        itemCount: 1,
        totalQuantity: 2,
        grandTotal: 120,
        amountPaid: 0,
        paymentMethod: "",
        status: "DELIVERED",
        placedAt: "2026-09-09T10:00:00Z",
      },
    ]);
    vi.mocked(api.updateOrderStatus).mockResolvedValue({} as never);
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    render(
      <QueryClientProvider client={client}>
        <OrdersPage />
      </QueryClientProvider>,
    );

    expect(await screen.findByRole("button", { name: "Annulée" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Livrée" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Annulée" }));
    await waitFor(() =>
      expect(api.updateOrderStatus).toHaveBeenCalledWith("invoice", "CANCELED"),
    );
    client.clear();
  });
});
