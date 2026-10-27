import { ConflictException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import type { DatabaseError } from 'pg';
import {
  defaultStorefrontSettings,
  defaultFeaturedSections,
  featuredSectionsSchema,
  discountCodeSchema,
  storefrontSettingsSchema,
  type DiscountCodeInput,
  type DiscountCodeItem,
  type StoreDiscount,
  type StorefrontSettings,
} from '@cosmetics/contracts';
import { DEFAULT_ORGANIZATION_ID } from '../constants.js';
import { DatabaseService } from '../database/database.service.js';

// Either the pool or a transaction client.
type Queryable = Pick<DatabaseService, 'query'>;

const settingsColumns = `store_catalog_source AS "catalogSource",
  store_product_scope AS "productScope",
  store_free_shipping_threshold::float AS "freeShippingThreshold",
  store_shipping_fee::float AS "shippingFee"`;

const codeColumns = `d.id, d.code, d.type, d.value::float AS value,
  d.min_subtotal::float AS "minSubtotal",
  to_char(d.expires_on, 'YYYY-MM-DD') AS "expiresOn", d.active,
  d.created_at AS "createdAt",
  (SELECT COUNT(*)::int FROM sales_orders o
    WHERE o.organization_id = d.organization_id AND o.discount_code = d.code
      AND o.status <> 'CANCELED') AS "usageCount"`;

/**
 * True when migration 017 has not reached this database yet (undefined column or
 * table), so shoppers keep today's behaviour until it is applied.
 */
export const storefrontMigrationPending = (error: unknown) =>
  ['42703', '42P01'].includes((error as DatabaseError | undefined)?.code ?? '');

const migrationRequired = () =>
  new ServiceUnavailableException(
    'La base de données doit être mise à jour (migrations 017_storefront_settings et 019_storefront_manager_and_curation) avant d’utiliser ces réglages.',
  );

/** Codes are valid through their last day, Moroccan time. */
const usableCode = `d.active = true
  AND (d.expires_on IS NULL OR d.expires_on >= (now() AT TIME ZONE 'Africa/Casablanca')::date)`;

@Injectable()
export class StoreSettingsService {
  constructor(private readonly db: DatabaseService) {}

  async settings(client: Queryable = this.db): Promise<StorefrontSettings> {
    try {
      const result = await client.query<StorefrontSettings>(
        `SELECT ${settingsColumns} FROM organizations WHERE id = $1`,
        [DEFAULT_ORGANIZATION_ID],
      );
      if (!result.rows[0]) throw new NotFoundException('Organisation introuvable.');
      try {
        const featured = await client.query<{ featured: unknown }>(
          'SELECT store_featured AS featured FROM organizations WHERE id = $1',
          [DEFAULT_ORGANIZATION_ID],
        );
        return { ...result.rows[0], featured: featuredSectionsSchema.parse(featured.rows[0]?.featured ?? {}) };
      } catch (error) {
        if (storefrontMigrationPending(error) && client === this.db)
          return { ...result.rows[0], featured: defaultFeaturedSections };
        throw error;
      }
    } catch (error) {
      // Inside a transaction a failed statement aborts it, so only the pool may fall back.
      if (storefrontMigrationPending(error) && client === this.db) return defaultStorefrontSettings;
      throw error;
    }
  }

  async updateSettings(input: StorefrontSettings, actorId: string): Promise<StorefrontSettings> {
    input = storefrontSettingsSchema.parse(input);
    return this.requireMigration(() => this.db.withTransaction(async (client) => {
      const before = await client.query(
        `SELECT ${settingsColumns} FROM organizations WHERE id = $1 FOR UPDATE`,
        [DEFAULT_ORGANIZATION_ID],
      );
      if (!before.rows[0]) throw new NotFoundException('Organisation introuvable.');
      const result = await client.query<StorefrontSettings>(
        `UPDATE organizations SET store_catalog_source = $2, store_product_scope = $3,
           store_free_shipping_threshold = $4, store_shipping_fee = $5, updated_at = now()
         WHERE id = $1 RETURNING ${settingsColumns}`,
        [
          DEFAULT_ORGANIZATION_ID,
          input.catalogSource,
          input.productScope,
          input.freeShippingThreshold,
          input.shippingFee,
        ],
      );
      await client.query(
        'UPDATE organizations SET store_featured = $2::jsonb WHERE id = $1',
        [DEFAULT_ORGANIZATION_ID, JSON.stringify(input.featured)],
      );
      const after = { ...result.rows[0]!, featured: input.featured };
      await this.audit(client, actorId, 'STOREFRONT_SETTINGS_UPDATED', DEFAULT_ORGANIZATION_ID, before.rows[0], after);
      return after;
    }));
  }

  async discountCodes(): Promise<DiscountCodeItem[]> {
    const result = await this.requireMigration(() =>
      this.db.query<DiscountCodeItem>(
        `SELECT ${codeColumns} FROM discount_codes d
         WHERE d.organization_id = $1 ORDER BY d.active DESC, d.created_at DESC`,
        [DEFAULT_ORGANIZATION_ID],
      ),
    );
    return result.rows;
  }

  async createDiscountCode(input: DiscountCodeInput, actorId: string): Promise<DiscountCodeItem> {
    input = discountCodeSchema.parse(input);
    return this.uniqueCode(() =>
      this.db.withTransaction(async (client) => {
        const created = await client.query<{ id: string }>(
          `INSERT INTO discount_codes
            (organization_id, code, type, value, min_subtotal, expires_on, active, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
          [DEFAULT_ORGANIZATION_ID, input.code, input.type, input.value, input.minSubtotal, input.expiresOn, input.active, actorId],
        );
        const item = await this.discountCode(client, created.rows[0]!.id);
        await this.audit(client, actorId, 'DISCOUNT_CODE_CREATED', item.id, null, item);
        return item;
      }),
    );
  }

  async updateDiscountCode(id: string, input: DiscountCodeInput, actorId: string): Promise<DiscountCodeItem> {
    input = discountCodeSchema.parse(input);
    return this.uniqueCode(() =>
      this.db.withTransaction(async (client) => {
        const before = await this.discountCode(client, id, true);
        await client.query(
          `UPDATE discount_codes SET code = $3, type = $4, value = $5, min_subtotal = $6,
             expires_on = $7, active = $8, updated_at = now()
           WHERE organization_id = $1 AND id = $2`,
          [DEFAULT_ORGANIZATION_ID, id, input.code, input.type, input.value, input.minSubtotal, input.expiresOn, input.active],
        );
        const item = await this.discountCode(client, id);
        await this.audit(client, actorId, 'DISCOUNT_CODE_UPDATED', id, before, item);
        return item;
      }),
    );
  }

  async deleteDiscountCode(id: string, actorId: string) {
    return this.requireMigration(() =>
      this.db.withTransaction(async (client) => {
        const before = await this.discountCode(client, id, true);
        await client.query('DELETE FROM discount_codes WHERE organization_id = $1 AND id = $2', [DEFAULT_ORGANIZATION_ID, id]);
        await this.audit(client, actorId, 'DISCOUNT_CODE_DELETED', id, before, null);
        return { deleted: true as const };
      }),
    );
  }

  /** An active, unexpired code as the storefront sees it, or undefined. */
  async findUsableCode(code: string, client: Queryable = this.db): Promise<StoreDiscount | undefined> {
    try {
      const result = await client.query<StoreDiscount>(
        `SELECT d.code, d.type, d.value::float AS value, d.min_subtotal::float AS "minSubtotal"
         FROM discount_codes d
         WHERE d.organization_id = $1 AND d.code = $2 AND ${usableCode}`,
        [DEFAULT_ORGANIZATION_ID, code.trim().toUpperCase()],
      );
      return result.rows[0];
    } catch (error) {
      if (storefrontMigrationPending(error) && client === this.db) return undefined;
      throw error;
    }
  }

  private async discountCode(client: Queryable, id: string, lock = false): Promise<DiscountCodeItem> {
    const result = await client.query<DiscountCodeItem>(
      `SELECT ${codeColumns} FROM discount_codes d
       WHERE d.organization_id = $1 AND d.id = $2${lock ? ' FOR UPDATE' : ''}`,
      [DEFAULT_ORGANIZATION_ID, id],
    );
    if (!result.rows[0]) throw new NotFoundException('Code de réduction introuvable.');
    return result.rows[0];
  }

  private async uniqueCode<T>(write: () => Promise<T>) {
    try {
      return await this.requireMigration(write);
    } catch (error) {
      if ((error as DatabaseError).code === '23505') throw new ConflictException('Ce code de réduction existe déjà.');
      throw error;
    }
  }

  private async requireMigration<T>(run: () => Promise<T>) {
    try {
      return await run();
    } catch (error) {
      if (storefrontMigrationPending(error)) throw migrationRequired();
      throw error;
    }
  }

  private async audit(client: Queryable, actorId: string, action: string, entityId: string, before: unknown, after: unknown) {
    await client.query(
      `INSERT INTO audit_logs
        (organization_id, actor_id, action, entity_type, entity_id, before_data, after_data)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb)`,
      [
        DEFAULT_ORGANIZATION_ID,
        actorId,
        action,
        action.startsWith('DISCOUNT') ? 'discount_code' : 'organization',
        entityId,
        before ? JSON.stringify(before) : null,
        after ? JSON.stringify(after) : null,
      ],
    );
  }
}
