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
import { defaultBrandSettings } from "../lib/brand-settings";
import { api } from "../lib/api";
import { SettingsPage } from "./SettingsPage";

vi.mock("../lib/api", () => ({
  ApiRequestError: class extends Error {},
  api: {
    brandSettings: vi.fn(),
    updateBrandSettings: vi.fn(),
  },
}));

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe("invoice brand settings", () => {
  it("loads, previews and saves the editable invoice details", async () => {
    vi.mocked(api.brandSettings).mockResolvedValue(defaultBrandSettings);
    vi.mocked(api.updateBrandSettings).mockImplementation(
      async (value) => value,
    );
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
