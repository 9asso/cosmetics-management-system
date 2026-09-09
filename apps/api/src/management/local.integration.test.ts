import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool, type PoolClient } from "pg";
import sharp from "sharp";
import { ManagementService } from "./management.service.js";
import { DashboardService } from "../dashboard/dashboard.service.js";
import { CatalogService } from "../catalog/catalog.service.js";
import type { DatabaseService } from "../database/database.service.js";
import { createProductSchema } from "@cosmetics/contracts";

// Opt-in, localhost-only, one transaction rolled back even if assertions fail.
const url = process.env.LOCAL_TEST_DATABASE_URL;
describe.skipIf(!url)("local commerce integration (rolled back)", () => {
  let pool: Pool;
  let client: PoolClient;
  let management: ManagementService;
  let dashboard: DashboardService;
  let catalog: CatalogService;
  let actorId: string;
  beforeAll(async () => {
    if (!["127.0.0.1", "localhost"].includes(new URL(url!).hostname))
      throw new Error("Local database required");
    pool = new Pool({ connectionString: url });
    client = await pool.connect();
    await client.query("BEGIN");
    const db = {
      query: client.query.bind(client),
      withTransaction: async (
        fn: (connection: PoolClient) => Promise<unknown>,
      ) => fn(client),
    } as unknown as DatabaseService;
    management = new ManagementService(db);
    dashboard = new DashboardService(db);
    catalog = new CatalogService(db);
    actorId = (
      await client.query(
        "SELECT id FROM users WHERE role = 'OWNER' AND active = true LIMIT 1",
      )
    ).rows[0].id;
  });
  afterAll(async () => {
    if (client) {
      await client.query("ROLLBACK");
      client.release();
    }
    await pool?.end();
  });

  it("reconciles actual chart movements, supplier images, archived invoice snapshots, and payment joins", async () => {
    const before = await dashboard.analytics("year");
    const supplier = await management.createSupplier({
      name: "QA Supplier Original",
      phone: "0600000000",
      email: "",
      address: "QA address",
    });
    const customer = await management.createCustomer({
      name: "QA Client Original",
      phone: "0600000001",
      email: "",
      address: "QA delivery address",
      creditLimit: 1000,
    });
    const image = await sharp({
      create: { width: 20, height: 20, channels: 3, background: "#ff4455" },
    })
      .png()
      .toBuffer();
    const product = await catalog.create(
      createProductSchema.parse({
        name: "QA Product",
        brand: "ONight",
        sku: `QA-${Date.now()}`,
        supplierId: supplier.id,
        purchasePrice: 10,
        wholesalePrice: 20,
        retailPrice: 30,
        initialQuantity: 10,
        retailVisible: true,
        imageUpload: { data: image.toString("base64") },
      }),
    );
    expect(product.supplierName).toBe(supplier.name);
    const imageId = product.imageUrl.split("/").at(-1)!;
    expect((await sharp(await catalog.image(imageId)).metadata()).format).toBe(
      "webp",
    );
    expect(
      (
        await catalog.list(
          { page: 1, pageSize: 100, search: product.sku, stock: "all" },
          true,
        )
      ).items[0]?.imageUrl,
    ).toBe(product.imageUrl);
    const sale = await management.createWholesaleSale(
      {
        customerId: customer.id,
        items: [{ variantId: product.variantId, quantity: 2, unitPrice: 20 }],
        paidAmount: 10,
        paymentMethod: "CASH",
        notes: "QA transaction rollback",
        discountTotal: 0,
        shippingTotal: 0,
        taxTotal: 0,
      },
      actorId,
    );
    const after = await dashboard.analytics("year");
    expect(
      after.periods.reduce((sum, row) => sum + row.revenue, 0) -
        before.periods.reduce((sum, row) => sum + row.revenue, 0),
    ).toBe(40);
    expect(
      after.periods.reduce((sum, row) => sum + row.grossMargin, 0) -
        before.periods.reduce((sum, row) => sum + row.grossMargin, 0),
    ).toBe(20);
    expect(after.periods).toHaveLength(12);
    expect((await dashboard.analytics("year")).periods).toHaveLength(12);
    expect((await dashboard.analytics("month")).periods).toHaveLength(30);
    expect((await dashboard.analytics("week")).periods).toHaveLength(7);
    await client.query(
      `INSERT INTO payments (organization_id, customer_id, direction, method, status, amount, reference)
      SELECT organization_id, customer_id, 'IN', 'CASH', 'COMPLETED', 1, order_number FROM sales_orders WHERE id = $1`,
      [sale.id],
    );
    const listed = await management.orders({
      search: sale.documentNumber,
      channel: "all",
      status: "DELIVERED",
    });
    expect(sale.status).toBe("DELIVERED");
    expect(listed[0]?.status).toBe("DELIVERED");
    expect(listed[0]?.totalQuantity).toBe(2);
    expect(listed[0]?.itemCount).toBe(1);
    await management.updatePartner(
      "customers",
      customer.id,
      {
        name: "QA Client Renamed",
        phone: "",
        email: "",
        address: "New address",
        creditLimit: 0,
      },
      actorId,
    );
    await management.archivePartner("customers", customer.id, actorId);
    expect(
      (await management.customers()).some((row) => row.id === customer.id),
    ).toBe(false);
    const invoice = await management.invoice("sale", sale.id);
    expect(invoice.partnerName).toBe("QA Client Original");
    expect(invoice.partner?.address).toBe("QA delivery address");
    expect(invoice.payments).toHaveLength(2);
    expect(
      (
        await management.invoices({
          search: sale.documentNumber,
          kind: "sale",
          page: 1,
        })
      ).items[0]?.id,
    ).toBe(sale.id);
    await expect(
      management.createWholesaleSale(
        {
          customerId: customer.id,
          items: [{ variantId: product.variantId, quantity: 1 }],
          paidAmount: 0,
          paymentMethod: "CREDIT",
          notes: "",
          discountTotal: 0,
          shippingTotal: 0,
          taxTotal: 0,
        },
        actorId,
      ),
    ).rejects.toThrow("archivé");
    await management.updateOrderStatus(sale.id, "CANCELED", actorId);
    const canceled = await dashboard.analytics("year");
    expect(canceled.periods.reduce((sum, row) => sum + row.revenue, 0)).toBe(
      before.periods.reduce((sum, row) => sum + row.revenue, 0),
    );
    await management.archivePartner("suppliers", supplier.id, actorId);
    await expect(
      catalog.create(
        createProductSchema.parse({
          name: "Invalid supplier product",
          brand: "ONight",
          sku: `QA-INVALID-${Date.now()}`,
          supplierId: supplier.id,
          purchasePrice: 1,
          wholesalePrice: 2,
          retailPrice: 3,
        }),
      ),
    ).rejects.toThrow("archivé");
  });

  it("rejects invalid image content and foreign contact identifiers", async () => {
    await expect(
      catalog.create(
        createProductSchema.parse({
          name: "Bad image",
          brand: "ONight",
          sku: "BAD-IMAGE",
          purchasePrice: 1,
          wholesalePrice: 2,
          retailPrice: 3,
          imageUpload: { data: Buffer.from("<svg></svg>").toString("base64") },
        }),
      ),
    ).rejects.toThrow("Image illisible");
    await expect(
      management.archivePartner(
        "customers",
        "00000000-0000-4000-8000-000000000099",
        actorId,
      ),
    ).rejects.toThrow("introuvable");
  });

  it("persists and audits editable invoice brand settings", async () => {
    expect((await management.brandSettings()).title).toBe(
      "O'NIGHT DISTRIBUTEUR",
    );
    const updated = await management.updateBrandSettings(
      {
        title: "O'NIGHT TEST",
        subtitle: "Distribution cosmetique",
        phones: "0600000000",
        thankYouText: "Merci !",
        returnPolicy: "Retour avec ticket uniquement.",
      },
      actorId,
    );
    expect(updated.title).toBe("O'NIGHT TEST");
    expect((await management.brandSettings()).phones).toBe("0600000000");
    expect(
      (
        await client.query(
          "SELECT COUNT(*)::int AS count FROM audit_logs WHERE action='BRAND_SETTINGS_UPDATED' AND actor_id=$1",
          [actorId],
        )
      ).rows[0].count,
    ).toBe(1);
  });
});
