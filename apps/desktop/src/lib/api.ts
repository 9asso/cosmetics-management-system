import type {
  AdjustInventoryInput,
  CreateProductInput,
  DashboardSummary,
  InventoryAdjustmentResult,
  Paginated,
  ProductListItem,
  ProductListQuery,
} from '@cosmetics/contracts';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api/v1';

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: { ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...init?.headers },
    });
  } catch {
    throw new ApiRequestError('Le serveur est inaccessible. Vérifiez que l’API est démarrée.', 0);
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new ApiRequestError(body?.message ?? 'Une erreur inattendue est survenue.', response.status);
  }
  return response.json() as Promise<T>;
}

export const api = {
  health: () => request<{ status: string }>('/health'),
  dashboard: () => request<DashboardSummary>('/dashboard/summary'),
  products: (query: Partial<ProductListQuery> = {}) => {
    const search = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== '') search.set(key, String(value));
    });
    return request<Paginated<ProductListItem>>(`/products?${search}`);
  },
  createProduct: (input: CreateProductInput) =>
    request<ProductListItem>('/products', { method: 'POST', body: JSON.stringify(input) }),
  adjustInventory: (input: AdjustInventoryInput) =>
    request<InventoryAdjustmentResult>('/inventory/adjustments', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
};
