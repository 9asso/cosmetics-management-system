import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  AuthUser,
  CreateUserInput,
  TeamUser,
  UserRole,
} from "@cosmetics/contracts";
import { Pencil, Plus, ShieldCheck, UserCheck, UserX } from "lucide-react";
import { ErrorState } from "../components/EmptyState";
import { Modal } from "../components/Modal";
import { EditNameModal } from "../components/EditNameModal";
import { StatusPill } from "../components/StatusPill";
import { api, ApiRequestError } from "../lib/api";
import { ui } from "../lib/ui";

const roleLabels: Record<UserRole, string> = {
  OWNER: "Administrateur",
  MANAGER: "Manager",
  CASHIER: "Vendeur",
  WAREHOUSE: "Magasinier",
  ACCOUNTANT: "Comptable",
  STAFF: "Employé",
};
const blank: CreateUserInput = {
  displayName: "",
  email: "",
  password: "",
  role: "STAFF",
};

export function TeamPage({
  currentUser,
  onUserSaved,
}: {
  currentUser: AuthUser;
  onUserSaved: (user: TeamUser) => void;
}) {
  const cache = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<TeamUser | null>(null);
  const [draft, setDraft] = useState(blank);
  const users = useQuery({ queryKey: ["users"], queryFn: api.users });
  const create = useMutation({
    mutationFn: api.createUser,
    onSuccess: () => {
      void cache.invalidateQueries({ queryKey: ["users"] });
      setShowCreate(false);
      setDraft(blank);
    },
  });
  const update = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      api.updateUser(id, { active }),
    onSuccess: () => cache.invalidateQueries({ queryKey: ["users"] }),
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    create.mutate(draft);
  };
  if (users.isError)
    return (
      <ErrorState
        message={
          users.error instanceof ApiRequestError
            ? users.error.message
            : "Impossible de charger l’équipe."
        }
        retry={() => void users.refetch()}
      />
    );
  return (
    <div className={ui("page-stack")}>
      <section className={ui("summary-strip")}>
        <div>
          <span className={ui("summary-icon pink")}>
            <ShieldCheck size={19} />
          </span>
          <small>Membres</small>
          <strong>{users.data?.length ?? 0}</strong>
        </div>
        <div>
          <span className={ui("summary-icon green")}>
            <UserCheck size={19} />
          </span>
          <small>Comptes actifs</small>
          <strong>
            {users.data?.filter((user) => user.active).length ?? 0}
          </strong>
        </div>
        <button
          className={ui("primary-button push-right")}
          onClick={() => {
            create.reset();
            setShowCreate(true);
          }}
        >
          <Plus size={17} /> Nouveau membre
        </button>
      </section>
      <p className="text-xs leading-relaxed text-muted">
        Vous pouvez modifier votre nom, le nom et le rôle des membres. Les comptes des
        autres administrateurs sont protégés.
      </p>
      <section className={ui("panel data-panel")}>
        {update.isError && (!(update.error instanceof ApiRequestError) || update.error.status !== 499) && (
          <p role="alert" className={ui("inline-error")}>
            {update.error instanceof ApiRequestError
              ? update.error.message
              : "Mise à jour impossible."}
          </p>
        )}
        <div className={ui("table-wrap")}>
          <table>
            <thead>
              <tr>
                <th>Membre</th>
                <th>Email</th>
                <th>Rôle</th>
                <th>État</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.isLoading && (
                <tr>
                  <td colSpan={5} className={ui("loading-cell")}>
                    Chargement des membres…
                  </td>
                </tr>
              )}
              {users.data?.map((user) => {
                const self = user.id === currentUser.id;
                const protectedAdmin = user.role === "OWNER" && !self;
                return (
                  <tr key={user.id}>
                    <td>
                      <strong>{user.displayName}</strong>
                      {self && <small className={ui("sub-cell")}>Vous</small>}
                    </td>
                    <td>{user.email}</td>
                    <td>{roleLabels[user.role]}</td>
                    <td>
                      <StatusPill tone={user.active ? "good" : "bad"}>
                        {user.active ? "Actif" : "Suspendu"}
                      </StatusPill>
                    </td>
                    <td>
                      {protectedAdmin ? (
                        <span className="inline-flex items-center gap-1.5 text-[10px] text-muted">
                          <ShieldCheck size={14} /> Compte protégé
                        </span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button
                            className={ui("secondary-button compact")}
                            aria-label={`Modifier le nom de ${user.displayName}`}
                            onClick={() => setEditing(user)}
                          >
                            <Pencil size={14} /> {self ? 'Modifier le nom' : 'Nom et rôle'}
                          </button>
                          {!self && (
                            <button
                              className={ui("secondary-button compact")}
                              disabled={update.isPending}
                              onClick={() =>
                                update.mutate({
                                  id: user.id,
                                  active: !user.active,
                                })
                              }
                            >
                              {user.active ? (
                                <UserX size={15} />
                              ) : (
                                <UserCheck size={15} />
                              )}
                              {user.active ? "Suspendre" : "Activer"}
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      {editing && (
        <EditNameModal
          key={editing.id}
          user={editing}
          allowRoleChange={editing.id !== currentUser.id && editing.role !== 'OWNER'}
          onClose={() => setEditing(null)}
          onSaved={onUserSaved}
        />
      )}
      {showCreate && (
        <Modal
          title="Ajouter un membre"
          subtitle="Les permissions sont contrôlées côté API selon le rôle."
          onClose={() => {
            if (!create.isPending) setShowCreate(false);
          }}
        >
          <form className={ui("product-form")} onSubmit={submit}>
            <div className={ui("form-grid")}>
              <label>
                <span>Nom complet</span>
                <input
                  required
                  minLength={2}
                  maxLength={160}
                  value={draft.displayName}
                  onChange={(e) =>
                    setDraft({ ...draft, displayName: e.target.value })
                  }
                />
              </label>
              <label>
                <span>Email</span>
                <input
                  required
                  type="email"
                  value={draft.email}
                  onChange={(e) =>
                    setDraft({ ...draft, email: e.target.value })
                  }
                />
              </label>
              <label>
                <span>Mot de passe temporaire</span>
                <input
                  required
                  minLength={8}
                  type="password"
                  value={draft.password}
                  onChange={(e) =>
                    setDraft({ ...draft, password: e.target.value })
                  }
                />
              </label>
              <label>
                <span>Rôle</span>
                <select
                  value={draft.role}
                  onChange={(e) =>
                    setDraft({ ...draft, role: e.target.value as UserRole })
                  }
                >
                  {Object.entries(roleLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {create.isError && (!(create.error instanceof ApiRequestError) || create.error.status !== 499) && (
              <p role="alert" className={ui("form-error")}>
                {create.error instanceof ApiRequestError
                  ? create.error.message
                  : "Création impossible."}
              </p>
            )}
            <footer className={ui("modal-actions")}>
              <button
                type="button"
                className={ui("secondary-button")}
                disabled={create.isPending}
                onClick={() => setShowCreate(false)}
              >
                Annuler
              </button>
              <button
                className={ui("primary-button")}
                disabled={create.isPending}
              >
                {create.isPending ? "Création…" : "Créer le compte"}
              </button>
            </footer>
          </form>
        </Modal>
      )}
    </div>
  );
}
