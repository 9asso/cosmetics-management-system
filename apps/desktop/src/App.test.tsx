// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App } from "./App";
import {
  api,
  ApiRequestError,
  hasAccessToken,
  setAccessToken,
} from "./lib/api";

vi.mock("./lib/api", () => {
  class ApiRequestError extends Error {
    constructor(
      message: string,
      public status: number,
    ) {
      super(message);
    }
  }
  return {
    ApiRequestError,
    hasAccessToken: vi.fn(),
    setAccessToken: vi.fn(),
    api: { me: vi.fn(), health: vi.fn(), login: vi.fn() },
  };
});
vi.mock("./pages/DashboardPage", () => ({
  DashboardPage: ({ reportOpen }: { reportOpen?: boolean }) => (
    <div>
      Dashboard ready
      {reportOpen && <span>Report modal ready</span>}
    </div>
  ),
}));
const user = {
  id: "owner",
  email: "owner@example.test",
  displayName: "Admin ONight",
  role: "OWNER" as const,
};
const stored = new Map<string, string>();
beforeEach(() => {
  stored.clear();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => stored.set(key, value),
      removeItem: (key: string) => stored.delete(key),
      clear: () => stored.clear(),
    },
  });
});
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  window.localStorage.clear();
  document.documentElement.classList.remove("dark");
});
describe("local session recovery", () => {
  it("opens the dashboard report from the top bar beside the purchase action", async () => {
    vi.mocked(hasAccessToken).mockReturnValue(true);
    vi.mocked(api.me).mockResolvedValue(user);
    vi.mocked(api.health).mockResolvedValue({ status: "ok" });
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <App />
      </QueryClientProvider>,
    );
    await screen.findByText("Dashboard ready");
    const purchase = screen.getByRole("button", { name: "Nouvel achat" });
    const report = screen.getByRole("button", { name: "Rapport complet" });
    expect(
      purchase.compareDocumentPosition(report) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    fireEvent.click(report);
    expect(screen.getByText("Report modal ready")).toBeTruthy();
    client.clear();
  });
  it("preserves a session when the development API temporarily restarts", async () => {
    vi.mocked(hasAccessToken).mockReturnValue(true);
    vi.mocked(api.me).mockRejectedValue(new ApiRequestError("Offline", 0));
    vi.mocked(api.health).mockResolvedValue({ status: "ok" });
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <App />
      </QueryClientProvider>,
    );
    expect(await screen.findByText(/Votre session est conservée/)).toBeTruthy();
    expect(setAccessToken).not.toHaveBeenCalledWith("");
    vi.mocked(api.me).mockResolvedValue(user);
    fireEvent.click(screen.getByRole("button", { name: /Réessayer/ }));
    expect(await screen.findByText("Dashboard ready")).toBeTruthy();
    client.clear();
  });
  it("replaces a cached auth error after a successful login", async () => {
    vi.mocked(hasAccessToken).mockReturnValue(false);
    vi.mocked(api.health).mockResolvedValue({ status: "ok" });
    vi.mocked(api.login).mockResolvedValue({
      user,
      accessToken: "local-test-token",
      expiresIn: 100,
    });
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    await client
      .fetchQuery({
        queryKey: ["me"],
        queryFn: () => Promise.reject(new ApiRequestError("Expired", 401)),
      })
      .catch(() => {});
    render(
      <QueryClientProvider client={client}>
        <App />
      </QueryClientProvider>,
    );
    fireEvent.change(screen.getByLabelText("Adresse email"), {
      target: { value: user.email },
    });
    fireEvent.change(screen.getByLabelText("Mot de passe"), {
      target: { value: "LocalPassword123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Se connecter" }));
    await waitFor(() =>
      expect(screen.getByText("Dashboard ready")).toBeTruthy(),
    );
    expect(client.getQueryData(["me"])).toEqual(user);
    client.clear();
  });
  it("keeps login light while restoring the saved dashboard theme after login", async () => {
    window.localStorage.setItem("onight-dashboard-theme", "dark");
    vi.mocked(hasAccessToken).mockReturnValue(false);
    vi.mocked(api.health).mockResolvedValue({ status: "ok" });
    vi.mocked(api.login).mockResolvedValue({
      user,
      accessToken: "local-test-token",
      expiresIn: 100,
    });
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <App />
      </QueryClientProvider>,
    );
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(window.localStorage.getItem("onight-dashboard-theme")).toBe("dark");
    fireEvent.change(screen.getByLabelText("Adresse email"), {
      target: { value: user.email },
    });
    fireEvent.change(screen.getByLabelText("Mot de passe"), {
      target: { value: "LocalPassword123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Se connecter" }));
    await screen.findByText("Dashboard ready");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Se déconnecter" }));
    await screen.findByRole("button", { name: "Se connecter" });
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(window.localStorage.getItem("onight-dashboard-theme")).toBe("dark");
    client.clear();
  });
  it("persists and applies the dashboard dark mode", async () => {
    vi.mocked(hasAccessToken).mockReturnValue(true);
    vi.mocked(api.me).mockResolvedValue(user);
    vi.mocked(api.health).mockResolvedValue({ status: "ok" });
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <App />
      </QueryClientProvider>,
    );
    expect(await screen.findByText("Dashboard ready")).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Activer le mode sombre" }),
    );
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(window.localStorage.getItem("onight-dashboard-theme")).toBe("dark");
    fireEvent.click(
      screen.getByRole("button", { name: "Activer le mode clair" }),
    );
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(window.localStorage.getItem("onight-dashboard-theme")).toBe("light");
    client.clear();
  });
});
