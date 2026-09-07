import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';
export default mergeConfig(viteConfig, defineConfig({
  // Keep DOM tests responsive while the local API, storefront and PDF renderer run.
  test: { maxWorkers: 2 },
}));
