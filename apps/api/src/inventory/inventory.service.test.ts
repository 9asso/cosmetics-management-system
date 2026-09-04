import { describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { InventoryService } from './inventory.service.js';
import type { DatabaseService } from '../database/database.service.js';

describe('InventoryService', () => {
  it('rejects an adjustment that would make stock negative', async () => {
    const client = {
      query: vi.fn().mockResolvedValueOnce({ rowCount: 1, rows: [{ onHand: 3, reserved: 1 }] }),
    };
    const db = {
      withTransaction: <T>(work: (value: typeof client) => Promise<T>) => work(client),
    } as unknown as DatabaseService;
    const service = new InventoryService(db);

    await expect(
      service.adjust({
        variantId: '4f7f6d2f-7ba2-4a3e-9a03-0a9d9324bca1',
        quantityDelta: -3,
        reason: 'CORRECTION',
        note: 'Physical stock count',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(client.query).toHaveBeenCalledTimes(1);
  });
});
