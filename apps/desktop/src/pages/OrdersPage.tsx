import { ui } from "../lib/ui";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { OrderStatus } from "@cosmetics/contracts";
import {
  CheckCircle2,
  PackageCheck,
  Search,
  ShoppingBag,
  Store,
  XCircle,
} from "lucide-react";
import { ErrorState } from "../components/EmptyState";
import { StatusPill } from "../components/StatusPill";
import { InvoiceDetailModal } from '../components/InvoiceDetailModal';
import { api, ApiRequestError } from "../lib/api";
import { integer, money } from "../lib/format";

const labels: Record<OrderStatus, string> = {
  ORDERED: "Commandée",
  CONFIRMED: "Confirmée",
  DELIVERED: "Livrée",
  CANCELED: "Annulée",
};

function tone(status: OrderStatus) {
  if (status === "DELIVERED") return "good" as const;
  if (status === "CANCELED") return "bad" as const;
  if (status === "CONFIRMED") return "neutral" as const;
  return "warn" as const;
}

export function OrdersPage({ canUpdate = true }: { canUpdate?: boolean }) {
  const client = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [channel, setChannel] = useState<
    "all" | "RETAIL_WEB" | "WHOLESALE_DESKTOP"
  >("all");
  const [status, setStatus] = useState<"all" | OrderStatus>("all");
  const orders = useQuery({
    queryKey: ["orders", search, channel, status],
    queryFn: () => api.orders({ search, channel, status }),
  });
  const changeStatus = useMutation({
    mutationFn: ({ id, next }: { id: string; next: OrderStatus }) =>
      api.updateOrderStatus(id, next),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["orders"] }),
        client.invalidateQueries({ queryKey: ["products"] }),
        client.invalidateQueries({ queryKey: ["dashboard-summary"] }),
      ]);
    },
  });

  if (orders.isError)
    return (
      <ErrorState
        message={
          orders.error instanceof ApiRequestError
            ? orders.error.message
            : "Impossible de charger les commandes."
        }
        retry={() => void orders.refetch()}
      />
    );

  return (
    <div className={ui("page-stack")}>
      <section className={ui("summary-strip")}>
        <div>
          <span className={ui("summary-icon pink")}>
            <ShoppingBag size={19} />
          </span>
          <small>Total affiché</small>
          <strong>{orders.data?.length ?? 0}</strong>
        </div>
        <div>
          <span className={ui("summary-icon amber")}>
            <Store size={19} />
          </span>
          <small>Commandées</small>
          <strong>
            {orders.data?.filter((order) => order.status === "ORDERED")
              .length ?? 0}
          </strong>
        </div>
        <div>
          <span className={ui("summary-icon green")}>
            <PackageCheck size={19} />
          </span>
          <small>Livrées</small>
          <strong>
            {orders.data?.filter((order) => order.status === "DELIVERED")
              .length ?? 0}
          </strong>
        </div>
      </section>
      <section className={ui("panel data-panel")}>
        <div className={ui("data-toolbar")}>
          <div className={ui("table-search")}>
            <Search size={17} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="N° commande ou client"
            />
          </div>
          <select
            value={channel}
            onChange={(event) =>
              setChannel(event.target.value as typeof channel)
            }
          >
            <option value="all">Tous les canaux</option>
            <option value="RETAIL_WEB">Boutique retail</option>
            <option value="WHOLESALE_DESKTOP">Vente grossiste</option>
          </select>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as typeof status)}
          >
            <option value="all">Tous les statuts</option>
            {Object.entries(labels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className={ui("table-wrap")}>
          <table>
            <thead>
              <tr>
                <th>Commande</th>
                <th>Client</th>
                <th>Canal</th>
                <th>Articles</th>
                <th>Total</th>
                <th>Paiement</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.isLoading && (
                <tr>
                  <td colSpan={8} className={ui("loading-cell")}>
                    Chargement des commandes…
                  </td>
                </tr>
              )}
              {orders.data?.map((order) => (
                <tr key={order.id} className="cursor-pointer" onClick={() => setSelectedId(order.id)}>
                  <td>
                    <strong>{order.orderNumber}</strong>
                    <small className={ui("sub-cell")}>
                      {new Intl.DateTimeFormat("fr-FR", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(order.placedAt))}
                    </small>
                  </td>
                  <td>
                    <button className="text-left font-bold text-brand hover:underline" onClick={event => { event.stopPropagation(); setSelectedId(order.id); }}>{order.customerName}</button>
                    <small className={ui("sub-cell")}>
                      {order.customerPhone || "Téléphone non renseigné"}
                    </small>
                  </td>
                  <td>
                    <span className={ui("channel-label")}>
                      {order.channel === "RETAIL_WEB" ? (
                        <Store size={14} />
                      ) : (
                        <ShoppingBag size={14} />
                      )}
                      {order.channel === "RETAIL_WEB" ? "Retail" : "Grossiste"}
                    </span>
                  </td>
                  <td>{integer.format(order.totalQuantity)} unités</td>
                  <td>
                    <strong>{money.format(order.grandTotal)}</strong>
                  </td>
                  <td>
                    {order.paymentMethod || "Crédit"}
                    <small className={ui("sub-cell")}>
                      {money.format(order.amountPaid)} encaissé
                    </small>
                  </td>
                  <td>
                    <StatusPill tone={tone(order.status)}>
                      {labels[order.status]}
                    </StatusPill>
                  </td>
                  <td>
                    <div className={ui("row-actions")} onClick={event => event.stopPropagation()}>
                      {canUpdate && order.status === "ORDERED" && (
                        <button
                          title="Confirmer"
                          disabled={changeStatus.isPending}
                          onClick={() =>
                            changeStatus.mutate({
                              id: order.id,
                              next: "CONFIRMED",
                            })
                          }
                        >
                          <CheckCircle2 size={16} />
                        </button>
                      )}
                      {canUpdate && order.status === "CONFIRMED" && (
                        <button
                          title="Marquer livrée"
                          disabled={changeStatus.isPending}
                          onClick={() =>
                            changeStatus.mutate({
                              id: order.id,
                              next: "DELIVERED",
                            })
                          }
                        >
                          <PackageCheck size={16} />
                        </button>
                      )}
                      {canUpdate &&
                        !["DELIVERED", "CANCELED"].includes(order.status) && (
                          <button
                            className={ui("danger")}
                            title="Annuler"
                            disabled={changeStatus.isPending}
                            onClick={() =>
                              changeStatus.mutate({
                                id: order.id,
                                next: "CANCELED",
                              })
                            }
                          >
                            <XCircle size={16} />
                          </button>
                        )}
                      {!canUpdate && <span>Lecture seule</span>}
                      {["DELIVERED", "CANCELED"].includes(order.status) && (
                        <span>Terminée</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {orders.data?.length === 0 && (
                <tr>
                  <td colSpan={8} className={ui("loading-cell")}>
                    Aucune commande ne correspond aux filtres.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {changeStatus.isError && (!(changeStatus.error instanceof ApiRequestError) || changeStatus.error.status !== 499) && (
          <p className={ui("inline-error")}>
            {changeStatus.error instanceof ApiRequestError
              ? changeStatus.error.message
              : "Mise à jour impossible."}
          </p>
        )}
      </section>
      {selectedId && <InvoiceDetailModal kind="sale" id={selectedId} surface="order" onClose={() => setSelectedId(null)} />}
    </div>
  );
}
