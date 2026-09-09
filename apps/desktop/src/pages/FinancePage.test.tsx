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
import { FinancePage, type FinanceTab } from "./FinancePage";
import { api } from "../lib/api";
import type { FinanceCheck } from "@cosmetics/contracts";
vi.mock("../lib/api", () => ({
  ApiRequestError: class extends Error {},
  api: {
    financeSummary: vi.fn(),
    financeBalances: vi.fn(),
    financeChecks: vi.fn(),
    expenses: vi.fn(),
    recordPayment: vi.fn(),
    createManualCheck: vi.fn(),
    updateCheck: vi.fn(),
    createExpense: vi.fn(),
  },
}));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});
function mount(
  tab: FinanceTab = "receivables",
  checkItems: FinanceCheck[] = [],
) {
  const payable = tab === "payables";
  vi.mocked(api.financeSummary).mockResolvedValue({
    receivables: 100,
    payables: 0,
    pendingChecks: 1,
    pendingCheckAmount: 40,
    dueChecks: 0,
    monthExpenses: 0,
    monthIncoming: 0,
    monthOutgoing: 0,
  });
  vi.mocked(api.financeBalances).mockResolvedValue({
    items: [
      {
        id: payable ? "purchase" : "sale",
        kind: payable ? "purchase" : "sale",
        documentNumber: payable ? "ACH-QA" : "FAC-QA",
        partnerName: payable ? "QA supplier" : "QA customer",
        phone: "",
        total: 100,
        amountPaid: 0,
        pendingAmount: 40,
        balance: 100,
        availableToPay: 60,
        issuedAt: "2026-09-01",
        ageDays: 4,
      },
    ],
    total: 1,
    page: 1,
    pageSize: 25,
  });
  vi.mocked(api.expenses).mockResolvedValue({
    items: [],
    total: 0,
    page: 1,
    pageSize: 25,
  });
  vi.mocked(api.financeChecks).mockResolvedValue({
    items: checkItems,
    total: checkItems.length,
    page: 1,
    pageSize: 25,
  });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <FinancePage initialTab={tab} />
    </QueryClientProvider>,
  );
  return client;
}
describe("finance workflows", () => {
  it("prefills the payable amount excluding pending checks and sends the settlement", async () => {
    const client = mount();
    vi.mocked(api.recordPayment).mockResolvedValue({ id: "payment" });
    fireEvent.click(await screen.findByRole("button", { name: "Encaisser" }));
    expect(
      (screen.getByLabelText("Montant du règlement (MAD)") as HTMLInputElement)
        .value,
    ).toBe("60");
    fireEvent.change(screen.getByLabelText("Montant du règlement (MAD)"), {
      target: { value: "20" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Enregistrer le règlement" }),
    );
    await waitFor(() =>
      expect(api.recordPayment).toHaveBeenCalledWith(
        "sale",
        "sale",
        expect.objectContaining({
          amount: 20,
          method: "CASH",
          requestId: expect.any(String),
        }),
      ),
    );
    expect(await screen.findByRole("status")).toBeTruthy();
    client.clear();
  });
  it("collects expense fields, then returns to history after saving", async () => {
    const client = mount("expenses");
    vi.mocked(api.createExpense).mockResolvedValue({ id: "expense" });
    fireEvent.click(
      await screen.findByRole("button", { name: "Nouvelle dépense" }),
    );
    fireEvent.change(screen.getByLabelText("Libellé"), {
      target: { value: "Livraison locale" },
    });
    fireEvent.change(screen.getByLabelText("Montant de la dépense (MAD)"), {
      target: { value: "50" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Enregistrer la dépense" }),
    );
    await waitFor(() =>
      expect(api.createExpense).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Livraison locale", amount: 50 }),
      ),
    );
    expect(
      await screen.findByText("La dépense a été enregistrée."),
    ).toBeTruthy();
    client.clear();
  });
  it("configures salaries as a monthly fixed expense", async () => {
    const client = mount("expenses");
    vi.mocked(api.createExpense).mockResolvedValue({ id: "salary" });
    fireEvent.click(
      await screen.findByRole("button", { name: "Nouvelle dépense" }),
    );
    fireEvent.change(screen.getByLabelText("Libellé"), {
      target: { value: "Salaires équipe" },
    });
    fireEvent.change(screen.getByLabelText("Catégorie"), {
      target: { value: "SALARIES" },
    });
    await waitFor(() =>
      expect(
        (screen.getByLabelText("Type de dépense") as HTMLSelectElement).value,
      ).toBe("FIXED"),
    );
    fireEvent.change(screen.getByLabelText("Montant de la dépense (MAD)"), {
      target: { value: "5000" },
    });
    await waitFor(() =>
      expect(
        (screen.getByLabelText("Type de dépense") as HTMLSelectElement).value,
      ).toBe("FIXED"),
    );
    fireEvent.change(
      await screen.findByLabelText("Jour automatique chaque mois"),
      {
        target: { value: "25" },
      },
    );
    fireEvent.change(screen.getByLabelText("Mode de paiement"), {
      target: { value: "CREDIT" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Enregistrer la dépense" }),
    );
    await waitFor(() =>
      expect(api.createExpense).toHaveBeenCalledWith(
        expect.objectContaining({
          category: "SALARIES",
          expenseType: "FIXED",
          recurringDay: 25,
          paymentMethod: "CREDIT",
        }),
      ),
    );
    client.clear();
  });
  it("opens the expense form when randomUUID is unavailable in the WebView", async () => {
    const originalCrypto = globalThis.crypto;
    vi.stubGlobal("crypto", {
      getRandomValues: (bytes: Uint8Array) =>
        originalCrypto.getRandomValues(bytes),
    });
    const client = mount("expenses");

    fireEvent.click(
      await screen.findByRole("button", { name: "Nouvelle dépense" }),
    );

    expect(
      screen.getByRole("dialog", { name: "Nouvelle dépense" }),
    ).toBeTruthy();
    client.clear();
  });
  it("opens the supplier settlement form when randomUUID is unavailable in the WebView", async () => {
    const originalCrypto = globalThis.crypto;
    vi.stubGlobal("crypto", {
      getRandomValues: (bytes: Uint8Array) =>
        originalCrypto.getRandomValues(bytes),
    });
    const client = mount("payables");

    fireEvent.click(await screen.findByRole("button", { name: "Régler" }));

    expect(
      screen.getByRole("dialog", { name: "Régler un fournisseur" }),
    ).toBeTruthy();
    expect(screen.getByText("ACH-QA · QA supplier")).toBeTruthy();
    client.clear();
  });
  it("opens the check filter directly and never fetches balances on that screen", async () => {
    const client = mount("checks");
    expect(await screen.findByText("Aucun chèque à afficher.")).toBeTruthy();
    expect(api.financeChecks).toHaveBeenCalledWith(
      expect.objectContaining({ status: "pending" }),
    );
    expect(api.financeBalances).not.toHaveBeenCalled();
    client.clear();
  });
  it("adds an unlinked cheque and keeps only the Encaissée action", async () => {
    const manualCheck: FinanceCheck = {
      id: "manual-check",
      kind: null,
      documentId: null,
      documentNumber: "Ancien chèque",
      partnerName: "Ancien client",
      direction: "IN",
      amount: 750,
      bankName: "Banque QA",
      checkNumber: "CHK-OLD-1",
      dueDate: "2026-08-01",
      status: "PENDING",
      documentStatus: null,
    };
    vi.mocked(api.createManualCheck).mockResolvedValue({ id: "new-check" });
    vi.mocked(api.updateCheck).mockResolvedValue({ id: "manual-check" });
    const client = mount("checks", [manualCheck]);

    expect(await screen.findByText("CHK-OLD-1")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Encaissée" })).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: /Déposer|Rejeté|Annuler/ }),
    ).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Encaissée" }));
    await waitFor(() =>
      expect(api.updateCheck).toHaveBeenCalledWith("manual-check", {
        status: "CLEARED",
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Ajouter un chèque" }));
    fireEvent.change(screen.getByLabelText("Client ou contact"), {
      target: { value: "Client historique" },
    });
    fireEvent.change(screen.getByLabelText("Montant du chèque (MAD)"), {
      target: { value: "1250" },
    });
    fireEvent.change(screen.getByLabelText("Banque"), {
      target: { value: "Banque Populaire" },
    });
    expect(
      screen.getByLabelText("Numéro du chèque").hasAttribute("required"),
    ).toBe(false);
    fireEvent.change(screen.getByLabelText("Échéance du chèque"), {
      target: { value: "2026-08-15" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Enregistrer le chèque" }),
    );
    await waitFor(() =>
      expect(api.createManualCheck).toHaveBeenCalledWith(
        expect.objectContaining({
          contactName: "Client historique",
          amount: 1250,
          check: expect.objectContaining({ checkNumber: "" }),
        }),
      ),
    );
    client.clear();
  });
});
