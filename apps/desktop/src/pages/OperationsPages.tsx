import { ui } from "../lib/ui";
import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  BusinessPartner,
  CreateCustomerInput,
  CreateSupplierInput,
} from "@cosmetics/contracts";
import {
  Building2,
  Plus,
  Users,
  Pencil, Trash2,
} from "lucide-react";
import { ErrorState } from "../components/EmptyState";
import { CommerceEntryPage } from "./CommerceEntryPage";
import { Modal } from "../components/Modal";
import { api, ApiRequestError } from "../lib/api";
import { money } from "../lib/format";

export function PurchasesPage() { return <CommerceEntryPage kind="purchase" />; }
export function WholesaleSalesPage() { return <CommerceEntryPage kind="sale" />; }

const blankSupplier: CreateSupplierInput = { name: "", phone: "", email: "", address: "" };
const blankCustomer: CreateCustomerInput = { ...blankSupplier, creditLimit: 0 };

export function PartnersPage({
  role = "OWNER",
}: {
  role?: "OWNER" | "MANAGER" | "CASHIER" | "WAREHOUSE" | "ACCOUNTANT" | "STAFF";
}) {
  const cache = useQueryClient();
  const [tab, setTab] = useState<"customers" | "suppliers">("customers");
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<BusinessPartner | null>(null);
  const [search, setSearch] = useState('');
  const [supplierDraft, setSupplierDraft] = useState(blankSupplier);
  const [customerDraft, setCustomerDraft] = useState(blankCustomer);
  const customers = useQuery({
    queryKey: ["customers"],
    queryFn: api.customers,
  });
  const suppliers = useQuery({
    queryKey: ["suppliers"],
    queryFn: api.suppliers,
  });
  const create = useMutation({
    mutationFn: () =>
      editing ? (tab === 'customers' ? api.updateCustomer(editing.id, customerDraft) : api.updateSupplier(editing.id, supplierDraft)) : tab === "customers"
        ? api.createCustomer(customerDraft)
        : api.createSupplier(supplierDraft),
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: [tab] });
      setShowCreate(false);
      setEditing(null);
      setSupplierDraft(blankSupplier);
      setCustomerDraft(blankCustomer);
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => tab === 'customers' ? api.deleteCustomer(id) : api.deleteSupplier(id),
    onSuccess: async () => { await cache.invalidateQueries({ queryKey: [tab] }); },
  });
  const currentList = tab === 'customers' ? customers : suppliers;
  const list = currentList.data?.filter(partner => `${partner.name} ${partner.phone} ${partner.email}`.toLowerCase().includes(search.toLowerCase()));
  const canCreate =
    ["OWNER", "MANAGER"].includes(role) ||
    (tab === "customers" && role === "CASHIER") ||
    (tab === "suppliers" && role === "WAREHOUSE");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    create.mutate();
  };
  if (currentList.isError) return <ErrorState message="Impossible de charger les contacts." retry={() => void currentList.refetch()} />;
  return (
    <div className={ui("page-stack")}>
      <section className={ui("panel data-panel")}>
        <div className={ui("data-toolbar")}>
          <div className={ui("segmented")}>
            <button
              className={ui(tab === "customers" ? "active" : "")}
              aria-pressed={tab === "customers"}
              onClick={() => setTab("customers")}
            >
              <Users size={15} /> Clients
            </button>
            <button
              className={ui(tab === "suppliers" ? "active" : "")}
              aria-pressed={tab === "suppliers"}
              onClick={() => setTab("suppliers")}
            >
              <Building2 size={15} /> Fournisseurs
            </button>
          </div>
          <input aria-label="Rechercher un contact" placeholder="Nom, téléphone, email" value={search} onChange={event => setSearch(event.target.value)} className="rounded-lg border border-line bg-surface px-3 py-2 text-xs text-ink outline-none focus:border-brand" />
          {canCreate && (
            <button
              className={ui("primary-button push-right")}
              onClick={() => { setEditing(null); setSupplierDraft(blankSupplier); setCustomerDraft(blankCustomer); create.reset(); setShowCreate(true); }}
            >
              <Plus size={17} /> Ajouter
            </button>
          )}
        </div>
        {remove.isError && (!(remove.error instanceof ApiRequestError) || remove.error.status !== 499) && <p role="alert" className={ui('inline-error')}>{remove.error instanceof ApiRequestError ? remove.error.message : 'Suppression impossible.'}</p>}
        {currentList.isLoading && <p className="p-5 text-sm text-muted">Chargement des contacts…</p>}
        {list?.length === 0 && <p className="p-5 text-sm text-muted">Aucun contact trouvé.</p>}
        <div className={ui("partner-grid")}>
          {list?.map((partner: BusinessPartner) => (
            <article className={ui("partner-card")} key={partner.id}>
              <span>
                {tab === "customers" ? (
                  <Users size={19} />
                ) : (
                  <Building2 size={19} />
                )}
              </span>
              <div>
                <strong>{partner.name}</strong>
                <small>{partner.phone || "Téléphone non renseigné"}</small>
                <small>
                  {partner.email ||
                    partner.address ||
                    "Coordonnées à compléter"}
                </small>
                {partner.creditLimit !== undefined && (
                  <em>Crédit autorisé : {money.format(partner.creditLimit)}</em>
                )}
                {role === 'OWNER' && <div className="mt-3 flex gap-2"><button className={ui('secondary-button compact')} aria-label={`Modifier ${partner.name}`} onClick={() => {
                  setEditing(partner); setSupplierDraft({ name: partner.name, phone: partner.phone, email: partner.email, address: partner.address });
                  setCustomerDraft({ name: partner.name, phone: partner.phone, email: partner.email, address: partner.address, creditLimit: partner.creditLimit ?? 0 }); create.reset(); setShowCreate(true);
                }}><Pencil size={13} /> Modifier</button><button className={ui('secondary-button compact')} disabled={remove.isPending} aria-label={`Supprimer ${partner.name}`} onClick={() => remove.mutate(partner.id)}><Trash2 size={13} /> Supprimer</button></div>}
              </div>
            </article>
          ))}
        </div>
      </section>
      {showCreate && (
        <Modal
          title={
            editing ? `Modifier · ${editing.name}` : tab === "customers"
              ? "Nouveau client grossiste"
              : "Nouveau fournisseur"
          }
          onClose={() => { if (!create.isPending) setShowCreate(false); }}
        >
          <form className={ui("product-form")} onSubmit={submit}>
            <div className={ui("form-grid")}>
              <label>
                <span>Nom</span>
                <input
                  required
                  minLength={2}
                  value={
                    tab === "customers"
                      ? customerDraft.name
                      : supplierDraft.name
                  }
                  onChange={(e) =>
                    tab === "customers"
                      ? setCustomerDraft({
                          ...customerDraft,
                          name: e.target.value,
                        })
                      : setSupplierDraft({
                          ...supplierDraft,
                          name: e.target.value,
                        })
                  }
                />
              </label>
              <label>
                <span>Téléphone</span>
                <input
                  value={
                    tab === "customers"
                      ? customerDraft.phone
                      : supplierDraft.phone
                  }
                  onChange={(e) =>
                    tab === "customers"
                      ? setCustomerDraft({
                          ...customerDraft,
                          phone: e.target.value,
                        })
                      : setSupplierDraft({
                          ...supplierDraft,
                          phone: e.target.value,
                        })
                  }
                />
              </label>
              <label>
                <span>Email</span>
                <input
                  type="email"
                  value={
                    tab === "customers"
                      ? customerDraft.email
                      : supplierDraft.email
                  }
                  onChange={(e) =>
                    tab === "customers"
                      ? setCustomerDraft({
                          ...customerDraft,
                          email: e.target.value,
                        })
                      : setSupplierDraft({
                          ...supplierDraft,
                          email: e.target.value,
                        })
                  }
                />
              </label>
              <label>
                <span>Adresse</span>
                <input
                  value={
                    tab === "customers"
                      ? customerDraft.address
                      : supplierDraft.address
                  }
                  onChange={(e) =>
                    tab === "customers"
                      ? setCustomerDraft({
                          ...customerDraft,
                          address: e.target.value,
                        })
                      : setSupplierDraft({
                          ...supplierDraft,
                          address: e.target.value,
                        })
                  }
                />
              </label>
              {tab === "customers" && (
                <label>
                  <span>Plafond de crédit</span>
                  <input
                    min="0"
                    type="number"
                    value={customerDraft.creditLimit}
                    onChange={(e) =>
                      setCustomerDraft({
                        ...customerDraft,
                        creditLimit: Number(e.target.value),
                      })
                    }
                  />
                </label>
              )}
            </div>
            {create.isError && (!(create.error instanceof ApiRequestError) || create.error.status !== 499) && (
              <p role="alert" className={ui("form-error")}>{create.error instanceof ApiRequestError ? create.error.message : 'Enregistrement impossible.'}</p>
            )}
            <footer className={ui("modal-actions")}>
              <button
                type="button"
                className={ui("secondary-button")}
                onClick={() => setShowCreate(false)}
              >
                Annuler
              </button>
              <button
                className={ui("primary-button")}
                disabled={create.isPending}
              >
                {create.isPending ? "Ajout…" : "Enregistrer"}
              </button>
            </footer>
          </form>
        </Modal>
      )}
    </div>
  );
}
