import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { AuthUser, TeamUser, UserRole } from "@cosmetics/contracts";
import { Modal } from "./Modal";
import { api, ApiRequestError } from "../lib/api";
import { ui } from "../lib/ui";

export function EditNameModal({
  user,
  onClose,
  onSaved,
  allowRoleChange = false,
}: {
  user: AuthUser;
  onClose: () => void;
  onSaved: (user: TeamUser) => void;
  allowRoleChange?: boolean;
}) {
  const cache = useQueryClient();
  const [name, setName] = useState(user.displayName);
  const [role, setRole] = useState<UserRole>(user.role);
  const update = useMutation({
    mutationFn: () => api.updateUser(user.id, { displayName: name.trim(), ...(allowRoleChange ? { role } : {}) }),
    onSuccess: (saved) => {
      onSaved(saved);
      void cache.invalidateQueries({ queryKey: ["users"] });
      onClose();
    },
  });
  function submit(event: FormEvent) {
    event.preventDefault();
    if (name.trim().length >= 2 && name.trim().length <= 160) update.mutate();
  }
  const close = () => {
    if (!update.isPending) onClose();
  };
  return (
    <Modal title={allowRoleChange ? 'Modifier le membre' : 'Modifier le nom'} subtitle={user.email} onClose={close}>
      <form className={ui("product-form")} onSubmit={submit}>
        <label>
          <span>Nom complet</span>
          <input
            autoFocus
            required
            minLength={2}
            maxLength={160}
            autoComplete="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={update.isPending}
          />
        </label>
        {allowRoleChange && <label><span>Rôle</span><select value={role} onChange={event => setRole(event.target.value as UserRole)} disabled={update.isPending}>
          {Object.entries({ OWNER: 'Administrateur', MANAGER: 'Manager', CASHIER: 'Vendeur', WAREHOUSE: 'Magasinier', ACCOUNTANT: 'Comptable', STAFF: 'Employé' }).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></label>}
        <p className={ui("form-hint")}>
          {allowRoleChange ? 'Le nouveau rôle modifie immédiatement les permissions côté serveur. Un membre promu administrateur devient un compte protégé.' : 'L’adresse email, le mot de passe et le rôle restent inchangés.'}
        </p>
        {update.isError && (!(update.error instanceof ApiRequestError) || update.error.status !== 499) && (
          <p role="alert" className={ui("form-error")}>
            {update.error instanceof ApiRequestError
              ? update.error.message
              : "Modification impossible. Réessayez."}
          </p>
        )}
        <footer className={ui("modal-actions")}>
          <button
            type="button"
            className={ui("secondary-button")}
            disabled={update.isPending}
            onClick={close}
          >
            Annuler
          </button>
          <button
            className={ui("primary-button")}
            disabled={
              update.isPending ||
              name.trim().length < 2 ||
              (name.trim() === user.displayName && (!allowRoleChange || role === user.role))
            }
          >
            {update.isPending ? "Enregistrement…" : allowRoleChange ? 'Enregistrer' : "Enregistrer le nom"}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
