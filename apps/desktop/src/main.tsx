import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from './App';
import './styles.css';
import { ConfirmationHost } from './components/ConfirmationHost';

const queryClient: QueryClient = new QueryClient({
  mutationCache: new MutationCache({ onSuccess: () => {
    for (const key of ['finance', 'orders', 'dashboard-summary', 'dashboard-analytics', 'invoices', 'invoice-detail', 'products', 'suppliers', 'customers']) {
      void queryClient.invalidateQueries({ queryKey: [key] });
    }
  } }),
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <ConfirmationHost />
    </QueryClientProvider>
  </StrictMode>,
);
