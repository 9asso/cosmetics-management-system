import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateUserInput, UserRole } from '@cosmetics/contracts';
import { Plus, ShieldCheck, UserCheck, UserX } from 'lucide-react';
import { ErrorState } from '../components/EmptyState';
import { Modal } from '../components/Modal';
import { StatusPill } from '../components/StatusPill';
import { api, ApiRequestError } from '../lib/api';

const roleLabels: Record<UserRole, string> = {
  OWNER: 'Propriétaire', MANAGER: 'Manager', CASHIER: 'Vendeur', WAREHOUSE: 'Magasinier', ACCOUNTANT: 'Comptable', STAFF: 'Employé',
};

const blank: CreateUserInput = { displayName: '', email: '', password: '', role: 'STAFF' };

export function TeamPage() {
  const cache = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [draft, setDraft] = useState(blank);
  const users = useQuery({ queryKey: ['users'], queryFn: api.users });
  const create = useMutation({ mutationFn: api.createUser, onSuccess: async () => { await cache.invalidateQueries({ queryKey: ['users'] }); setShowCreate(false); setDraft(blank); } });
  const update = useMutation({ mutationFn: ({ id, active }: { id: string; active: boolean }) => api.updateUser(id, { active }), onSuccess: () => cache.invalidateQueries({ queryKey: ['users'] }) });
  const submit = (event: FormEvent) => { event.preventDefault(); create.mutate(draft); };
  if (users.isError) return <ErrorState message={users.error instanceof ApiRequestError ? users.error.message : 'Impossible de charger l’équipe.'} retry={() => void users.refetch()} />;
  return <div className="page-stack"><section className="summary-strip"><div><span className="summary-icon pink"><ShieldCheck size={19} /></span><small>Membres</small><strong>{users.data?.length ?? 0}</strong></div><div><span className="summary-icon green"><UserCheck size={19} /></span><small>Comptes actifs</small><strong>{users.data?.filter((user) => user.active).length ?? 0}</strong></div><button className="primary-button push-right" onClick={() => setShowCreate(true)}><Plus size={17} /> Nouveau membre</button></section><section className="panel data-panel"><div className="table-wrap"><table><thead><tr><th>Membre</th><th>Email</th><th>Rôle</th><th>État</th><th>Action</th></tr></thead><tbody>{users.data?.map((user) => <tr key={user.id}><td><strong>{user.displayName}</strong></td><td>{user.email}</td><td>{roleLabels[user.role]}</td><td><StatusPill tone={user.active ? 'good' : 'bad'}>{user.active ? 'Actif' : 'Suspendu'}</StatusPill></td><td><button className="secondary-button compact" onClick={() => update.mutate({ id: user.id, active: !user.active })}>{user.active ? <UserX size={15} /> : <UserCheck size={15} />}{user.active ? 'Suspendre' : 'Activer'}</button></td></tr>)}</tbody></table></div></section>{showCreate && <Modal title="Ajouter un membre" subtitle="Les permissions sont contrôlées côté API selon le rôle." onClose={() => setShowCreate(false)}><form className="product-form" onSubmit={submit}><div className="form-grid"><label><span>Nom complet</span><input required value={draft.displayName} onChange={(e) => setDraft({ ...draft, displayName: e.target.value })} /></label><label><span>Email</span><input required type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} /></label><label><span>Mot de passe temporaire</span><input required minLength={8} type="password" value={draft.password} onChange={(e) => setDraft({ ...draft, password: e.target.value })} /></label><label><span>Rôle</span><select value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value as UserRole })}>{Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>{create.isError && <p className="form-error">{create.error instanceof ApiRequestError ? create.error.message : 'Création impossible.'}</p>}<footer className="modal-actions"><button type="button" className="secondary-button" onClick={() => setShowCreate(false)}>Annuler</button><button className="primary-button" disabled={create.isPending}>{create.isPending ? 'Création…' : 'Créer le compte'}</button></footer></form></Modal>}</div>;
}
