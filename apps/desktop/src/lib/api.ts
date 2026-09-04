import type {
  AdjustInventoryInput,
  AuthUser,
  BusinessPartner,
  CreateCustomerInput,
  CreateProductInput,
  CreatePurchaseInput,
  CreateSupplierInput,
  CreateUserInput,
  CreateWholesaleSaleInput,
  DashboardSummary,
  InventoryAdjustmentResult,
  LoginInput,
  LoginResult,
  OperationResult,
  OrderListItem,
  OrderListQuery,
  OrderStatus,
  Paginated,
  ProductListItem,
  ProductListQuery,
  TeamUser,
  UpdateUserInput,
  DashboardAnalytics, DashboardAnalyticsRange, InvoiceListItem, InvoiceDetail, InvoiceQuery,
} from '@cosmetics/contracts';
import { confirmChange, mutationConfirmation } from './confirmation';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api/v1';
const TOKEN_KEY = 'cosmetics_access_token';
let accessToken = typeof window === 'undefined' ? '' : (window.localStorage.getItem(TOKEN_KEY) ?? '');

export function setAccessToken(token: string) {
  accessToken = token;
  if (typeof window === 'undefined') return;
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
  else window.localStorage.removeItem(TOKEN_KEY);
}

export function hasAccessToken() {
  return Boolean(accessToken);
}

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (init?.method && !['GET', 'HEAD'].includes(init.method) && path !== '/auth/login') {
    const confirmed = await confirmChange(mutationConfirmation(path, init.method, typeof init.body === 'string' ? init.body : undefined));
    if (!confirmed) throw new ApiRequestError('', 499);
  }
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiRequestError('Le serveur est inaccessible. Vérifiez votre connexion.', 0);
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string | string[] } | null;
    const message = Array.isArray(body?.message) ? body.message.join(' · ') : body?.message;
    throw new ApiRequestError(message ?? 'Une erreur inattendue est survenue.', response.status);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

function queryString(values: Record<string, unknown>) {
  const query = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== '') query.set(key, String(value));
  });
  return query.toString();
}

export const api = {
  health: () => request<{ status: string }>('/health'),
  login: (input: LoginInput) =>
    request<LoginResult>('/auth/login', { method: 'POST', body: JSON.stringify(input) }),
  me: () => request<AuthUser>('/auth/me'),
  dashboard: () => request<DashboardSummary>('/dashboard/summary'),
  analytics: (range: DashboardAnalyticsRange = 'year') => request<DashboardAnalytics>(`/dashboard/analytics?range=${range}`),
  invoices: (query: Partial<InvoiceQuery> = {}) => request<Paginated<InvoiceListItem>>(`/invoices?${queryString(query)}`),
  invoice: (kind: 'sale' | 'purchase', id: string) => request<InvoiceDetail>(`/invoices/${kind}/${id}`),
  products: (query: Partial<ProductListQuery> = {}) =>
    request<Paginated<ProductListItem>>(`/products?${queryString(query)}`),
  createProduct: (input: CreateProductInput) =>
    request<ProductListItem>('/products', { method: 'POST', body: JSON.stringify(input) }),
  adjustInventory: (input: AdjustInventoryInput) =>
    request<InventoryAdjustmentResult>('/inventory/adjustments', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  suppliers: () => request<BusinessPartner[]>('/suppliers'),
  updateSupplier: (id: string, input: CreateSupplierInput) => request<BusinessPartner>(`/suppliers/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
  deleteSupplier: (id: string) => request<{ archived: boolean }>(`/suppliers/${id}`, { method: 'DELETE' }),
  updateCustomer: (id: string, input: CreateCustomerInput) => request<BusinessPartner>(`/customers/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
  deleteCustomer: (id: string) => request<{ archived: boolean }>(`/customers/${id}`, { method: 'DELETE' }),
  createSupplier: (input: CreateSupplierInput) =>
    request<BusinessPartner>('/suppliers', { method: 'POST', body: JSON.stringify(input) }),
  customers: () => request<BusinessPartner[]>('/customers'),
  createCustomer: (input: CreateCustomerInput) =>
    request<BusinessPartner>('/customers', { method: 'POST', body: JSON.stringify(input) }),
  createPurchase: (input: CreatePurchaseInput) =>
    request<OperationResult>('/purchases', { method: 'POST', body: JSON.stringify(input) }),
  createWholesaleSale: (input: CreateWholesaleSaleInput) =>
    request<OperationResult>('/wholesale-sales', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  orders: (query: Partial<OrderListQuery> = {}) =>
    request<OrderListItem[]>(`/orders?${queryString(query)}`),
  updateOrderStatus: (id: string, status: OrderStatus) =>
    request<OrderListItem>(`/orders/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  users: () => request<TeamUser[]>('/users'),
  createUser: (input: CreateUserInput) =>
    request<TeamUser>('/users', { method: 'POST', body: JSON.stringify(input) }),
  updateUser: (id: string, input: UpdateUserInput) =>
    request<TeamUser>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
};
