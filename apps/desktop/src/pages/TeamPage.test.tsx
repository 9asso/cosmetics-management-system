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
import type { TeamUser } from "@cosmetics/contracts";
import { TeamPage } from "./TeamPage";
import { api, ApiRequestError } from "../lib/api";

vi.mock("../lib/api", () => {
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
    api: { users: vi.fn(), updateUser: vi.fn(), createUser: vi.fn() },
  };
});
const owner: TeamUser = {
  id: "owner",
  email: "owner@example.test",
  displayName: "Admin ONight",
  role: "OWNER",
  active: true,
  createdAt: "2026-01-01",
};
const staff: TeamUser = {
  ...owner,
  id: "staff",
  email: "staff@example.test",
  displayName: "Demo Staff",
  role: "STAFF",
};
const peer: TeamUser = { ...owner, id: "peer", displayName: "Other Admin" };
function setup() {
  vi.mocked(api.users).mockResolvedValue([owner, staff, peer]);
  const saved = vi.fn();
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <TeamPage currentUser={owner} onUserSaved={saved} />
    </QueryClientProvider>,
  );
  return saved;
}
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
describe("team name editing", () => {
  it("offers own/staff edits but no peer admin edits or self suspension", async () => {
    setup();
    expect(
      await screen.findByRole("button", {
        name: "Modifier le nom de Admin ONight",
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Modifier le nom de Demo Staff" }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Modifier le nom de Other Admin" }),
    ).toBeNull();
    expect(screen.getAllByRole("button", { name: "Suspendre" })).toHaveLength(
      1,
    );
  });
  it("saves a trimmed name without changing any other user fields", async () => {
    vi.mocked(api.updateUser).mockResolvedValue({
      ...staff,
      displayName: "New Staff",
    });
    const saved = setup();
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Modifier le nom de Demo Staff",
      }),
    );
    fireEvent.change(screen.getByLabelText("Nom complet"), {
      target: { value: "  New Staff  " },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Enregistrer$/ }));
    await waitFor(() =>
      expect(saved).toHaveBeenCalledWith(
        expect.objectContaining({ displayName: "New Staff" }),
      ),
    );
    expect(api.updateUser).toHaveBeenCalledWith("staff", {
      displayName: "New Staff",
      role: 'STAFF',
    });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("keeps the editor open and reports permission errors", async () => {
    vi.mocked(api.updateUser).mockRejectedValue(
      new ApiRequestError("Compte protégé.", 403),
    );
    setup();
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Modifier le nom de Demo Staff",
      }),
    );
    fireEvent.change(screen.getByLabelText("Nom complet"), {
      target: { value: "Changed" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Enregistrer$/ }));
    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "Compte protégé.",
    );
    expect(screen.getByRole("dialog")).toBeTruthy();
  });
  it('allows changing a regular member role without changing the name', async () => {
    vi.mocked(api.updateUser).mockResolvedValue({ ...staff, role: 'MANAGER' });
    setup();
    fireEvent.click(await screen.findByRole('button', { name: 'Modifier le nom de Demo Staff' }));
    fireEvent.change(screen.getByLabelText('Rôle'), { target: { value: 'MANAGER' } });
    fireEvent.click(screen.getByRole('button', { name: /^Enregistrer$/ }));
    await waitFor(() => expect(api.updateUser).toHaveBeenCalledWith('staff', { displayName: 'Demo Staff', role: 'MANAGER' }));
  });
});
