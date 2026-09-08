import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import sharp from "sharp";
import type {
  CreateProductInput,
  ProductMediaInput,
  Paginated,
  ProductListItem,
  ProductListQuery,
  ProductStockLot,
} from "@cosmetics/contracts";
import type { DatabaseError } from "pg";
import { DEFAULT_LOCATION_ID, DEFAULT_ORGANIZATION_ID } from "../constants.js";
import { DatabaseService } from "../database/database.service.js";

type ProductRow = Omit<
  ProductListItem,
  | "purchasePrice"
  | "wholesalePrice"
  | "retailPrice"
  | "compareAtPrice"
  | "onHand"
  | "reserved"
  | "available"
> & {
  purchasePrice: string;
  wholesalePrice: string;
  retailPrice: string;
  compareAtPrice: string | null;
  onHand: number;
  reserved: number;
  available: number;
  totalCount: string;
};

@Injectable()
export class CatalogService {
  constructor(private readonly db: DatabaseService) {}

  async uploadMedia(bytes: Buffer) {
    if (
      !Buffer.isBuffer(bytes) ||
      !bytes.length ||
      bytes.length > 30 * 1024 * 1024
    )
      throw new BadRequestException("Fichier vide ou supérieur à 30 Mo.");
    let data = bytes;
    let mime = "";
    if (
      bytes.length >= 12 &&
      bytes.toString("ascii", 4, 8) === "ftyp" &&
      ["isom", "iso2", "mp41", "mp42", "avc1", "M4V "].includes(
        bytes.toString("ascii", 8, 12),
      )
    )
      mime = "video/mp4";
    else if (
      bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])) &&
      bytes.subarray(0, 4096).includes(Buffer.from("webm"))
    )
      mime = "video/webm";
    else {
      if (bytes.length > 5 * 1024 * 1024)
        throw new BadRequestException(
          "Images limitées à 5 Mo. Vidéos : MP4 ou WebM, 30 Mo maximum.",
        );
      try {
        const source = sharp(bytes, { limitInputPixels: 25_000_000 });
        const metadata = await source.metadata();
        if (!["jpeg", "png", "webp"].includes(metadata.format ?? ""))
          throw new Error("format");
        data = await source
          .rotate()
          .resize({
            width: 1600,
            height: 1600,
            fit: "inside",
            withoutEnlargement: true,
          })
          .webp({ quality: 85 })
          .toBuffer();
        mime = "image/webp";
      } catch {
        throw new BadRequestException(
          "Format non reconnu. Utilisez JPG, PNG, WebP, MP4 ou WebM.",
        );
      }
    }
    const saved = await this.db.query<{ id: string }>(
      "INSERT INTO product_media_assets (organization_id, mime_type, data) VALUES ($1, $2, $3) RETURNING id",
      [DEFAULT_ORGANIZATION_ID, mime, data],
    );
    const base = (
      process.env.PUBLIC_API_URL ??
      process.env.API_URL ??
      "http://localhost:4000/api/v1"
    ).replace(/\/$/, "");
    return {
      url: `${base}/media/assets/${saved.rows[0]!.id}`,
      type: mime.startsWith("video/") ? "video" : "image",
    };
  }

  async mediaAsset(id: string) {
    const result = await this.db.query<{ data: Buffer; mime: string }>(
      "SELECT data, mime_type AS mime FROM product_media_assets WHERE id = $1 AND organization_id = $2",
      [id, DEFAULT_ORGANIZATION_ID],
    );
    if (!result.rows[0]) throw new NotFoundException("Média introuvable.");
    return result.rows[0];
  }

  async updateMedia(id: string, input: ProductMediaInput) {
    await this.db.withTransaction(async (client) => {
      const before = await client.query(
        "SELECT images, video_url FROM products WHERE id = $1 AND organization_id = $2 AND active = true FOR UPDATE",
        [id, DEFAULT_ORGANIZATION_ID],
      );
      if (!before.rowCount) throw new NotFoundException("Produit introuvable.");
      await client.query(
        "UPDATE products SET images = $1::jsonb, image_url = $2, video_url = $3, updated_at = now() WHERE id = $4",
        [
          JSON.stringify(input.images),
          input.images[0] ?? "",
          input.videoUrl,
          id,
        ],
      );
      await client.query(
        `INSERT INTO audit_logs (organization_id, action, entity_type, entity_id, before_data, after_data) VALUES ($1, 'PRODUCT_MEDIA_UPDATED', 'product', $2, $3::jsonb, $4::jsonb)`,
        [
          DEFAULT_ORGANIZATION_ID,
          id,
          JSON.stringify(before.rows[0]),
          JSON.stringify(input),
        ],
      );
    });
    return input;
  }

  async image(id: string) {
    const result = await this.db.query<{ data: Buffer }>(
      "SELECT data FROM product_images WHERE id = $1 AND organization_id = $2",
      [id, DEFAULT_ORGANIZATION_ID],
    );
    if (!result.rows[0]) throw new NotFoundException("Image introuvable.");
    return result.rows[0].data;
  }

  async stockLots(productId: string): Promise<ProductStockLot[]> {
    const result = await this.db.query<ProductStockLot>(
      `WITH inbound AS (
        SELECT m.id,m.quantity_delta::int AS quantity,m.created_at,
          COALESCE(m.unit_cost,v.purchase_price)::float AS "purchasePrice",
          COALESCE(NULLIF(i.wholesale_price_snapshot,0),v.wholesale_price)::float AS "wholesalePrice",
          COALESCE(NULLIF(i.retail_price_snapshot,0),v.retail_price)::float AS "retailPrice",
          CASE
            WHEN m.reason='PURCHASE_RECEIPT' THEN COALESCE(o.order_number,'Réception fournisseur')
            WHEN m.reason='OPENING_BALANCE' THEN 'Stock initial'
            WHEN m.reason='CUSTOMER_RETURN' THEN 'Retour client'
            ELSE 'Ajustement de stock'
          END AS source,
          b.on_hand::int AS "onHand"
        FROM inventory_movements m
        JOIN product_variants v ON v.id=m.variant_id
        JOIN products p ON p.id=v.product_id
        JOIN inventory_balances b ON b.variant_id=v.id AND b.location_id=m.location_id
        LEFT JOIN purchase_orders o ON m.reference_type='purchase_order' AND o.id=m.reference_id
        LEFT JOIN purchase_order_items i ON i.purchase_order_id=o.id AND i.variant_id=v.id
        WHERE p.id=$1 AND p.organization_id=$2 AND m.quantity_delta>0
      ), ranked AS (
        SELECT *,COALESCE(SUM(quantity) OVER(
          ORDER BY created_at DESC,id DESC ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
        ),0)::int AS newer_quantity
        FROM inbound
      )
      SELECT id,source,created_at::text AS "receivedOn",quantity AS "receivedQuantity",
        LEAST(quantity,GREATEST(0,"onHand"-newer_quantity))::int AS "remainingQuantity",
        "purchasePrice","wholesalePrice","retailPrice"
      FROM ranked
      WHERE LEAST(quantity,GREATEST(0,"onHand"-newer_quantity)) > 0
      ORDER BY created_at,id`,
      [productId, DEFAULT_ORGANIZATION_ID],
    );
    if (!result.rowCount) {
      const found = await this.db.query(
        "SELECT 1 FROM products WHERE id=$1 AND organization_id=$2 AND active=true",
        [productId, DEFAULT_ORGANIZATION_ID],
      );
      if (!found.rowCount) throw new NotFoundException("Produit introuvable.");
    }
    return result.rows;
  }

  async list(
    query: ProductListQuery,
    retailOnly = false,
  ): Promise<Paginated<ProductListItem>> {
    const values: unknown[] = [DEFAULT_ORGANIZATION_ID, DEFAULT_LOCATION_ID];
    const filters = [
      "p.organization_id = $1",
      "p.active = true",
      "v.active = true",
    ];
    if (retailOnly) filters.push("p.retail_visible = true");

    if (query.search) {
      values.push(`%${query.search.toLowerCase()}%`);
      const index = values.length;
      filters.push(`(
        lower(p.name) LIKE $${index} OR lower(p.brand) LIKE $${index}
        OR lower(v.sku) LIKE $${index} OR lower(COALESCE(v.barcode, '')) LIKE $${index}
        OR lower(v.reference) LIKE $${index}
      )`);
    }
    if (query.category) {
      values.push(query.category);
      filters.push(`p.category = $${values.length}`);
    }
    if (query.stock === "low") {
      filters.push(
        "(COALESCE(b.on_hand, 0) - COALESCE(b.reserved, 0)) > 0 AND (COALESCE(b.on_hand, 0) - COALESCE(b.reserved, 0)) <= v.low_stock_threshold",
      );
    } else if (query.stock === "out") {
      filters.push("(COALESCE(b.on_hand, 0) - COALESCE(b.reserved, 0)) = 0");
    }

    values.push(query.pageSize, (query.page - 1) * query.pageSize);
    const limitIndex = values.length - 1;
    const offsetIndex = values.length;
    const result = await this.db.query<ProductRow>(
      `SELECT
        p.id,
        v.id AS "variantId",
        p.name,
        p.brand,
        p.category,
        p.description,
        p.image_url AS "imageUrl",
        p.images,
        p.video_url AS "videoUrl",
        p.source_url AS "sourceUrl",
        v.sku,
        COALESCE(v.barcode, '') AS barcode,
        v.reference,
        COALESCE(s.name, '') AS "supplierName",
        v.purchase_price AS "purchasePrice",
        v.wholesale_price AS "wholesalePrice",
        v.retail_price AS "retailPrice",
        v.compare_at_price AS "compareAtPrice",
        COALESCE(b.on_hand, 0)::int AS "onHand",
        COALESCE(b.reserved, 0)::int AS reserved,
        (COALESCE(b.on_hand, 0) - COALESCE(b.reserved, 0))::int AS available,
        v.low_stock_threshold AS "lowStockThreshold",
        p.retail_visible AS "retailVisible",
        COUNT(*) OVER()::text AS "totalCount"
      FROM products p
      JOIN product_variants v ON v.product_id = p.id
      LEFT JOIN inventory_balances b ON b.variant_id = v.id AND b.location_id = $2
      LEFT JOIN product_supplier_links psl ON psl.variant_id = v.id AND psl.preferred = true
      LEFT JOIN suppliers s ON s.id = psl.supplier_id
      WHERE ${filters.join(" AND ")}
      ORDER BY ${retailOnly ? "(p.image_url <> '') DESC, p.updated_at DESC" : "(COALESCE(b.on_hand, 0) - COALESCE(b.reserved, 0)) ASC, p.brand ASC, p.name ASC, v.id"}
      LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
      values,
    );

    const items = result.rows.map(({ totalCount: _total, ...row }) => ({
      ...row,
      purchasePrice: Number(row.purchasePrice),
      wholesalePrice: Number(row.wholesalePrice),
      retailPrice: Number(row.retailPrice),
      compareAtPrice:
        row.compareAtPrice === null ? null : Number(row.compareAtPrice),
    }));

    return {
      items,
      page: query.page,
      pageSize: query.pageSize,
      total: Number(result.rows[0]?.totalCount ?? 0),
    };
  }

  async create(input: CreateProductInput): Promise<ProductListItem> {
    let image: Buffer | undefined;
    if (input.imageUpload) {
      const data = input.imageUpload.data;
      if (!/^[A-Za-z0-9+/]+={0,2}$/.test(data))
        throw new BadRequestException("Image invalide.");
      const bytes = Buffer.from(data, "base64");
      if (bytes.length > 5 * 1024 * 1024)
        throw new BadRequestException("Image limitée à 5 Mo.");
      try {
        const source = sharp(bytes, { limitInputPixels: 25_000_000 });
        const metadata = await source.metadata();
        if (!["jpeg", "png", "webp"].includes(metadata.format ?? ""))
          throw new Error("format");
        image = await source
          .rotate()
          .resize({
            width: 1600,
            height: 1600,
            fit: "inside",
            withoutEnlargement: true,
          })
          .webp({ quality: 85 })
          .toBuffer();
        if (image.length > 2 * 1024 * 1024) throw new Error("size");
      } catch {
        throw new BadRequestException(
          "Image illisible ou trop grande. Utilisez JPG, PNG ou WebP (25 mégapixels maximum).",
        );
      }
    }
    try {
      const identifiers = await this.db.withTransaction(async (client) => {
        let imageUrl = input.imageUrl;
        if (image) {
          const saved = await client.query<{ id: string }>(
            "INSERT INTO product_images (organization_id, data) VALUES ($1, $2) RETURNING id",
            [DEFAULT_ORGANIZATION_ID, image],
          );
          const base = (
            process.env.PUBLIC_API_URL ??
            process.env.API_URL ??
            "http://localhost:4000/api/v1"
          ).replace(/\/$/, "");
          imageUrl = `${base}/media/${saved.rows[0]!.id}`;
        }
        const product = await client.query<{ id: string }>(
          `INSERT INTO products
            (organization_id, name, brand, category, description, image_url, source_url, retail_visible)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING id`,
          [
            DEFAULT_ORGANIZATION_ID,
            input.name,
            input.brand,
            input.category,
            input.description,
            imageUrl,
            input.sourceUrl,
            input.retailVisible,
          ],
        );
        const productId = product.rows[0]!.id;
        const media = input.media ?? {
          images: imageUrl ? [imageUrl] : [],
          videoUrl: "",
        };
        await client.query(
          "UPDATE products SET images = $1::jsonb, image_url = $2, video_url = $3 WHERE id = $4",
          [
            JSON.stringify(media.images),
            media.images[0] ?? "",
            media.videoUrl,
            productId,
          ],
        );

        const variant = await client.query<{ id: string }>(
          `INSERT INTO product_variants
            (product_id, sku, barcode, reference, purchase_price, wholesale_price,
             retail_price, compare_at_price, low_stock_threshold)
           VALUES ($1, $2, NULLIF($3, ''), $4, $5, $6, $7, $8, $9)
           RETURNING id`,
          [
            productId,
            input.sku,
            input.barcode,
            input.reference,
            input.purchasePrice,
            input.wholesalePrice,
            input.retailPrice,
            input.compareAtPrice ?? null,
            input.lowStockThreshold,
          ],
        );
        const variantId = variant.rows[0]!.id;

        if (input.supplierId) {
          const supplier = await client.query(
            "SELECT id FROM suppliers WHERE id = $1 AND organization_id = $2 AND active = true FOR SHARE",
            [input.supplierId, DEFAULT_ORGANIZATION_ID],
          );
          if (!supplier.rowCount)
            throw new BadRequestException(
              "Fournisseur archivé ou introuvable.",
            );
          await client.query(
            "INSERT INTO product_supplier_links (variant_id, supplier_id, preferred) VALUES ($1, $2, true)",
            [variantId, input.supplierId],
          );
        } else if (input.supplierName) {
          const supplier = await client.query<{ id: string }>(
            `INSERT INTO suppliers (organization_id, name)
             SELECT $1, $2
             WHERE NOT EXISTS (
               SELECT 1 FROM suppliers WHERE organization_id = $1 AND lower(name) = lower($2)
             )
             RETURNING id`,
            [DEFAULT_ORGANIZATION_ID, input.supplierName],
          );
          const supplierId =
            supplier.rows[0]?.id ??
            (
              await client.query<{ id: string }>(
                "SELECT id FROM suppliers WHERE organization_id = $1 AND lower(name) = lower($2) LIMIT 1",
                [DEFAULT_ORGANIZATION_ID, input.supplierName],
              )
            ).rows[0]!.id;
          await client.query(
            `INSERT INTO product_supplier_links (variant_id, supplier_id, preferred)
             VALUES ($1, $2, true)`,
            [variantId, supplierId],
          );
        }

        await client.query(
          `INSERT INTO inventory_balances (variant_id, location_id, on_hand)
           VALUES ($1, $2, $3)`,
          [variantId, DEFAULT_LOCATION_ID, input.initialQuantity],
        );

        if (input.initialQuantity > 0) {
          await client.query(
            `INSERT INTO inventory_movements
              (organization_id, variant_id, location_id, quantity_delta, reason, unit_cost, note)
             VALUES ($1, $2, $3, $4, 'OPENING_BALANCE', $5, 'Initial product quantity')`,
            [
              DEFAULT_ORGANIZATION_ID,
              variantId,
              DEFAULT_LOCATION_ID,
              input.initialQuantity,
              input.purchasePrice,
            ],
          );
        }

        await client.query(
          `INSERT INTO audit_logs (organization_id, action, entity_type, entity_id, after_data)
           VALUES ($1, 'PRODUCT_CREATED', 'product', $2, $3::jsonb)`,
          [
            DEFAULT_ORGANIZATION_ID,
            productId,
            JSON.stringify({ ...input, imageUpload: undefined, imageUrl }),
          ],
        );
        await client.query(
          `INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, payload)
           VALUES ('product', $1, 'catalog.product.created', $2::jsonb)`,
          [productId, JSON.stringify({ productId, variantId })],
        );

        return { productId, variantId };
      });

      const page = await this.list({
        page: 1,
        pageSize: 100,
        search: input.sku,
        stock: "all",
      });
      const created = page.items.find(
        (item) => item.variantId === identifiers.variantId,
      );
      if (!created) throw new Error("Created product could not be loaded");
      return created;
    } catch (error) {
      if ((error as DatabaseError).code === "23505") {
        throw new ConflictException("SKU or barcode already exists");
      }
      throw error;
    }
  }
}
