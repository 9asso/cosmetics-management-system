import sharp from "sharp";
import { randomUUID } from "node:crypto";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import { Pool, type PoolClient } from "pg";
import { FinanceService } from "./finance.service.js";
import { ManagementService } from "../management/management.service.js";
import { CatalogService } from "../catalog/catalog.service.js";
import { DashboardService } from "../dashboard/dashboard.service.js";
import type { DatabaseService } from "../database/database.service.js";
import { createProductSchema, financeQuerySchema } from "@cosmetics/contracts";
const url = process.env.LOCAL_TEST_DATABASE_URL;
describe.skipIf(!url)(
  "finance local database integration (rolled back)",
  () => {
    let pool: Pool;
    let client: PoolClient;
    let finance: FinanceService;
    let management: ManagementService;
    let dashboard: DashboardService;
    let catalog: CatalogService;
    let actor: string;
    beforeAll(async () => {
      if (!["localhost", "127.0.0.1"].includes(new URL(url!).hostname))
        throw new Error("Local database required");
      pool = new Pool({ connectionString: url });
    });
    beforeEach(async () => {
      client = await pool.connect();
      await client.query("BEGIN");
      const db = {
        query: client.query.bind(client),
        withTransaction: async <T>(fn: (client: PoolClient) => Promise<T>) => {
          await client.query("SAVEPOINT operation");
          try {
            const value = await fn(client);
            await client.query("RELEASE SAVEPOINT operation");
            return value;
          } catch (error) {
            await client.query("ROLLBACK TO SAVEPOINT operation");
            await client.query("RELEASE SAVEPOINT operation");
            throw error;
          }
        },
      } as unknown as DatabaseService;
      finance = new FinanceService(db);
      management = new ManagementService(db);
      dashboard = new DashboardService(db);
      catalog = new CatalogService(db);
      actor = (
        await client.query(
          "SELECT id FROM users WHERE role='OWNER' AND active=true LIMIT 1",
        )
      ).rows[0].id;
    });
    afterEach(async () => {
      await client.query("ROLLBACK");
      client.release();
    });
    afterAll(async () => {
      await pool?.end();
    });
    async function fixture() {
      const customer = await management.createCustomer({
        name: "Finance QA Customer",
        phone: "0600000000",
        email: "",
        address: "QA",
        creditLimit: 1000,
      });
      const supplier = await management.createSupplier({
        name: "Finance QA Supplier",
        phone: "",
        email: "",
        address: "",
      });
      const product = await catalog.create(
        createProductSchema.parse({
          name: "Finance QA product",
          brand: "QA",
          sku: `QA-${randomUUID()}`,
          purchasePrice: 10,
          wholesalePrice: 20,
          retailPrice: 30,
          initialQuantity: 20,
        }),
      );
      return { customer, supplier, product };
    }
    it("persists featured galleries and preview video, validates uploads, and audits edits", async () => {
      const { product } = await fixture();
      const image = await sharp({
        create: { width: 30, height: 30, channels: 3, background: "#ff848f" },
      })
        .png()
        .toBuffer();
      const first = await catalog.uploadMedia(image);
      expect(first.type).toBe("image");
      const asset = await catalog.mediaAsset(first.url.split("/").at(-1)!);
      expect(asset.mime).toBe("image/webp");
      expect((await sharp(asset.data).metadata()).format).toBe("webp");
      await expect(
        catalog.uploadMedia(Buffer.from('<svg onload="alert(1)"/>')),
      ).rejects.toThrow();
      await expect(
        catalog.uploadMedia(Buffer.alloc(31 * 1024 * 1024)),
      ).rejects.toThrow();
      await catalog.updateMedia(product.id, {
        images: [first.url, "/products/catalog/example.webp"],
        videoUrl: "https://example.test/preview.mp4",
      });
      const saved = (
        await catalog.list({
          search: product.sku,
          page: 1,
          pageSize: 10,
          stock: "all",
        })
      ).items[0]!;
      expect(saved.imageUrl).toBe(first.url);
      expect(saved.images).toHaveLength(2);
      expect(saved.videoUrl).toBe("https://example.test/preview.mp4");
      await catalog.updateMedia(product.id, { images: [], videoUrl: "" });
      const cleared = (
        await catalog.list({
          search: product.sku,
          page: 1,
          pageSize: 10,
          stock: "all",
        })
      ).items[0]!;
      expect(cleared.imageUrl).toBe("");
      expect(cleared.images).toEqual([]);
      expect(
        (
          await client.query(
            "SELECT count(*) FROM audit_logs WHERE entity_id=$1 AND action='PRODUCT_MEDIA_UPDATED'",
            [product.id],
          )
        ).rows[0].count,
      ).toBe("2");
    });
    it("uses available stock for alerts and inventory filters, excluding archived variants", async () => {
      const { product } = await fixture();
      const before = await dashboard.summary();
      await client.query(
        "UPDATE inventory_balances SET reserved=on_hand WHERE variant_id=$1",
        [product.variantId],
      );
      const reservedQuantity = Number(
        (
          await client.query<{ reserved: string }>(
            "SELECT reserved::text FROM inventory_balances WHERE variant_id=$1",
            [product.variantId],
          )
        ).rows[0]!.reserved,
      );
      const out = await catalog.list({
        page: 1,
        pageSize: 100,
        search: product.sku,
        stock: "out",
      });
      expect(out.items[0]?.variantId).toBe(product.variantId);
      expect((await dashboard.summary()).outOfStockCount).toBe(
        before.outOfStockCount + 1,
      );
      expect((await dashboard.summary()).reservedUnits).toBe(
        before.reservedUnits + reservedQuantity,
      );
      await client.query(
        "UPDATE product_variants SET active=false WHERE id=$1",
        [product.variantId],
      );
      expect((await dashboard.summary()).outOfStockCount).toBe(
        before.outOfStockCount,
      );
    });
    it("processes multi-product receipts and sales atomically with cent precision", async () => {
      const { customer, supplier, product } = await fixture();
      await catalog.updateMedia(product.id, {
        images: ["/products/catalog/finance-qa-product.webp"],
        videoUrl: "",
      });
      const second = await catalog.create(
        createProductSchema.parse({
          name: "QA second product",
          brand: "QA",
          sku: `QA-${randomUUID()}`,
          purchasePrice: 5,
          wholesalePrice: 9.99,
          retailPrice: 15,
          initialQuantity: 5,
        }),
      );
      const purchase = await management.createPurchase(
        {
          supplierId: supplier.id,
          items: [
            { variantId: product.variantId, quantity: 2, unitCost: 10.01 },
            { variantId: second.variantId, quantity: 3, unitCost: 5.03 },
          ],
          paidAmount: 0,
          paymentMethod: "CREDIT",
          notes: "",
        },
        actor,
      );
      expect(purchase.total).toBe(35.11);
      expect(
        (await dashboard.analytics("month")).products.recentPurchases,
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            productId: product.id,
            quantity: 2,
            partnerName: supplier.name,
          }),
        ]),
      );
      const before = await catalog.list({
        page: 1,
        pageSize: 100,
        search: product.sku,
        stock: "all",
      });
      await expect(
        management.createWholesaleSale(
          {
            customerId: customer.id,
            items: [
              { variantId: product.variantId, quantity: 1 },
              { variantId: second.variantId, quantity: 999 },
            ],
            paidAmount: 0,
            paymentMethod: "CREDIT",
            notes: "",
            discountTotal: 0,
            shippingTotal: 0,
            taxTotal: 0,
          },
          actor,
        ),
      ).rejects.toThrow("Stock insuffisant");
      expect(
        (
          await catalog.list({
            page: 1,
            pageSize: 100,
            search: product.sku,
            stock: "all",
          })
        ).items[0]?.onHand,
      ).toBe(before.items[0]?.onHand);
      const sale = await management.createWholesaleSale(
        {
          customerId: customer.id,
          items: [
            { variantId: product.variantId, quantity: 2, unitPrice: 20.01 },
            { variantId: second.variantId, quantity: 3, unitPrice: 9.99 },
          ],
          paidAmount: 0,
          paymentMethod: "CREDIT",
          notes: "",
          discountTotal: 0,
          shippingTotal: 0,
          taxTotal: 0,
        },
        actor,
      );
      expect(sale.total).toBe(69.99);
      expect((await management.invoice("sale", sale.id)).items).toHaveLength(2);
      const dashboardAnalytics = await dashboard.analytics("month");
      const productAnalytics = dashboardAnalytics.products;
      expect(productAnalytics.recentSales).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            productId: product.id,
            quantity: 2,
            channel: "WHOLESALE",
          }),
        ]),
      );
      expect(productAnalytics.topWholesale.length).toBeGreaterThan(0);
      expect(productAnalytics.topWholesale.length).toBeLessThanOrEqual(5);
      expect(
        productAnalytics.topWholesale.map(({ unitsSold }) => unitsSold),
      ).toEqual(
        [
          ...productAnalytics.topWholesale.map(({ unitsSold }) => unitsSold),
        ].sort((left, right) => right - left),
      );
      expect(dashboardAnalytics.customers.topWholesale.length).toBeGreaterThan(
        0,
      );
      expect(
        dashboardAnalytics.customers.topWholesale.length,
      ).toBeLessThanOrEqual(5);
      expect(dashboardAnalytics.customers.topCities.length).toBeGreaterThan(0);
    });
    it("records partial cash and transfer settlements, rejects overpayment, and retries exactly once", async () => {
      const { customer, product } = await fixture();
      const sale = await management.createWholesaleSale(
        {
          customerId: customer.id,
          items: [{ variantId: product.variantId, quantity: 5 }],
          paidAmount: 0,
          paymentMethod: "CREDIT",
          notes: "",
          discountTotal: 0,
          shippingTotal: 0,
          taxTotal: 0,
        },
        actor,
      );
      const input = {
        requestId: randomUUID(),
        amount: 40,
        method: "CASH" as const,
      };
      const first = await finance.recordPayment("sale", sale.id, input, actor);
      expect(
        await finance.recordPayment("sale", sale.id, input, actor),
      ).toEqual(first);
      await expect(
        finance.recordPayment("sale", sale.id, { ...input, amount: 41 }, actor),
      ).rejects.toThrow("déjà");
      await expect(
        finance.recordPayment(
          "sale",
          sale.id,
          { ...input, requestId: randomUUID(), amount: 61 },
          actor,
        ),
      ).rejects.toThrow("dépasse");
      let invoice = await management.invoice("sale", sale.id);
      expect(invoice.amountPaid).toBe(40);
      expect(invoice.payments).toHaveLength(1);
      expect(invoice.status).toBe("PARTIALLY_PAID");
      const balances = await finance.balances(
        financeQuerySchema.parse({ search: sale.documentNumber }),
      );
      expect(balances.items[0]?.balance).toBe(60);
      await finance.recordPayment(
        "sale",
        sale.id,
        { requestId: randomUUID(), amount: 60, method: "CASH" },
        actor,
      );
      invoice = await management.invoice("sale", sale.id);
      expect(invoice.amountPaid).toBe(100);
      expect(invoice.status).toBe("PAID");
      expect(
        (
          await finance.balances(
            financeQuerySchema.parse({ search: sale.documentNumber }),
          )
        ).total,
      ).toBe(0);
      expect(
        (
          await client.query(
            "SELECT COUNT(*)::int AS n FROM audit_logs WHERE action='PAYMENT_RECORDED' AND after_data->>'documentId'=$1",
            [sale.id],
          )
        ).rows[0].n,
      ).toBe(2);
    });
    it("tracks weighted purchase cost, invoice corrections, three payments, returns, refunds and version history", async () => {
      const { customer, supplier, product } = await fixture();
      const before = await dashboard.report("2020-01-01", "2099-12-31");
      const purchase = await management.createPurchase(
        {
          supplierId: supplier.id,
          items: [
            {
              variantId: product.variantId,
              quantity: 20,
              unitCost: 20,
              wholesalePrice: 31,
              retailPrice: 41,
            },
          ],
          paidAmount: 0,
          paymentMethod: "CREDIT",
          notes: "Deuxième lot à prix différent",
        },
        actor,
      );
      expect(purchase.total).toBe(400);
      const afterPurchase = (
        await catalog.list({
          page: 1,
          pageSize: 10,
          search: product.sku,
          stock: "all",
        })
      ).items[0]!;
      expect(afterPurchase.onHand).toBe(40);
      expect(afterPurchase.purchasePrice).toBe(15);
      expect(await catalog.stockLots(product.id)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            source: purchase.documentNumber,
            remainingQuantity: 20,
            purchasePrice: 20,
            wholesalePrice: 31,
            retailPrice: 41,
          }),
        ]),
      );
      await management.updateInvoice(
        "purchase",
        purchase.id,
        {
          partnerId: supplier.id,
          items: [
            { variantId: product.variantId, quantity: 20, unitPrice: 22 },
          ],
          discountTotal: 0,
          shippingTotal: 0,
          taxTotal: 0,
          notes: "Coût fournisseur corrigé",
        },
        actor,
      );
      expect(
        (
          await catalog.list({
            page: 1,
            pageSize: 10,
            search: product.sku,
            stock: "all",
          })
        ).items[0]?.purchasePrice,
      ).toBe(16);

      const sale = await management.createWholesaleSale(
        {
          customerId: customer.id,
          items: [{ variantId: product.variantId, quantity: 5, unitPrice: 30 }],
          discountTotal: 10,
          shippingTotal: 12,
          taxTotal: 8,
          paidAmount: 0,
          paymentMethod: "CREDIT",
          notes: "Facture à corriger",
        },
        actor,
      );
      expect(sale.total).toBe(160);
      await management.updateInvoice(
        "sale",
        sale.id,
        {
          partnerId: customer.id,
          items: [{ variantId: product.variantId, quantity: 5, unitPrice: 32 }],
          discountTotal: 10,
          shippingTotal: 12,
          taxTotal: 8,
          notes: "Prix corrigé",
        },
        actor,
      );
      for (const amount of [70, 50, 50]) {
        await finance.recordPayment(
          "sale",
          sale.id,
          { requestId: randomUUID(), amount, method: "CASH" },
          actor,
        );
      }
      let invoice = await management.invoice("sale", sale.id);
      expect(invoice.total).toBe(170);
      expect(invoice.amountPaid).toBe(170);
      expect(invoice.payments).toHaveLength(3);
      expect(invoice.history.map((entry) => entry.eventType)).toEqual(
        expect.arrayContaining(["CREATED", "UPDATED", "PAYMENT_RECORDED"]),
      );

      const correctedLine = invoice.items[0]!;
      await management.createInvoiceReturn(
        sale.id,
        {
          items: [
            {
              invoiceItemId: correctedLine.id,
              quantity: 2,
              disposition: "RESTOCK",
            },
          ],
          refundAmount: 64,
          refundMethod: "CASH",
          reason: "Retour partiel QA",
        },
        actor,
      );
      await management.recordInvoicePrint("sale", sale.id, actor);
      invoice = await management.invoice("sale", sale.id);
      expect(invoice.total).toBe(106);
      expect(invoice.amountPaid).toBe(106);
      expect(invoice.items[0]?.returnedQuantity).toBe(2);
      expect(invoice.returns).toHaveLength(1);
      expect(
        invoice.payments.filter((payment) => payment.direction === "OUT"),
      ).toHaveLength(1);
      expect(invoice.history[0]?.eventType).toBe("PRINTED");
      expect(
        invoice.history.some((entry) => entry.eventType === "RETURNED"),
      ).toBe(true);
      expect(
        (
          await catalog.list({
            page: 1,
            pageSize: 10,
            search: product.sku,
            stock: "all",
          })
        ).items[0]?.onHand,
      ).toBe(37);
      expect(
        (await catalog.stockLots(product.id)).reduce(
          (sum, lot) => sum + lot.remainingQuantity,
          0,
        ),
      ).toBe(37);

      const after = await dashboard.report("2020-01-01", "2099-12-31");
      expect(after.purchases - before.purchases).toBe(440);
      expect(after.salesRevenue - before.salesRevenue).toBe(106);
      expect(after.grossMargin - before.grossMargin).toBe(38);
      expect(after.customerRefunds - before.customerRefunds).toBe(64);
      expect(after.salesCount - before.salesCount).toBe(1);
      expect(after.unitsSold).toBeGreaterThan(0);
      expect(after.periods.length).toBeGreaterThan(0);
      expect(after.documents).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: sale.id,
            paidAmount: 106,
          }),
        ]),
      );
    });
    it("keeps checks outstanding until clearance and reserves their face value against duplicate collection", async () => {
      const { customer, product } = await fixture();
      const check = {
        bankName: "QA bank",
        checkNumber: "QA-123",
        dueDate: "2026-09-01",
      };
      const sale = await management.createWholesaleSale(
        {
          customerId: customer.id,
          items: [{ variantId: product.variantId, quantity: 5 }],
          paidAmount: 40,
          paymentMethod: "CHECK",
          check,
          notes: "",
          discountTotal: 0,
          shippingTotal: 0,
          taxTotal: 0,
        },
        actor,
      );
      expect((await management.invoice("sale", sale.id)).amountPaid).toBe(0);
      let balance = (
        await finance.balances(
          financeQuerySchema.parse({ search: sale.documentNumber }),
        )
      ).items[0]!;
      expect(balance.pendingAmount).toBe(40);
      expect(balance.availableToPay).toBe(60);
      expect(balance.balance).toBe(100);
      const listed = (
        await finance.checks(
          financeQuerySchema.parse({ search: sale.documentNumber }),
        )
      ).items[0]!;
      expect(listed.checkNumber).toBe("QA-123");
      await expect(
        finance.recordPayment(
          "sale",
          sale.id,
          { requestId: randomUUID(), amount: 61, method: "CASH" },
          actor,
        ),
      ).rejects.toThrow("dépasse");
      await finance.updateCheck(listed.id, { status: "DEPOSITED" }, actor);
      expect((await management.invoice("sale", sale.id)).amountPaid).toBe(0);
      await finance.updateCheck(listed.id, { status: "CLEARED" }, actor);
      expect((await management.invoice("sale", sale.id)).amountPaid).toBe(40);
      await expect(
        finance.updateCheck(listed.id, { status: "CLEARED" }, actor),
      ).rejects.toThrow("déjà");
      balance = (
        await finance.balances(
          financeQuerySchema.parse({ search: sale.documentNumber }),
        )
      ).items[0]!;
      expect(balance.pendingAmount).toBe(0);
      expect(balance.balance).toBe(60);
    });
    it("releases a rejected supplier check, supports a replacement, and preserves receipt status", async () => {
      const { supplier, product } = await fixture();
      const purchase = await management.createPurchase(
        {
          supplierId: supplier.id,
          items: [{ variantId: product.variantId, quantity: 10, unitCost: 10 }],
          paidAmount: 0,
          paymentMethod: "CREDIT",
          notes: "",
        },
        actor,
      );
      const check = await finance.recordPayment(
        "purchase",
        purchase.id,
        {
          requestId: randomUUID(),
          method: "CHECK",
          amount: 100,
          check: {
            bankName: "QA bank",
            checkNumber: "123",
            dueDate: "2026-10-01",
          },
        },
        actor,
      );
      expect(
        (await management.invoice("purchase", purchase.id)).amountPaid,
      ).toBe(0);
      await finance.updateCheck(check.id, { status: "BOUNCED" }, actor);
      const balances = await finance.balances(
        financeQuerySchema.parse({
          kind: "purchase",
          search: purchase.documentNumber,
        }),
      );
      expect(balances.items[0]?.availableToPay).toBe(100);
      await finance.recordPayment(
        "purchase",
        purchase.id,
        { requestId: randomUUID(), method: "CASH", amount: 100 },
        actor,
      );
      const invoice = await management.invoice("purchase", purchase.id);
      expect(invoice.amountPaid).toBe(100);
      expect(invoice.status).toBe("RECEIVED");
    });
    it("rejects payments on cancelled and undelivered COD orders; cancellation closes pending checks", async () => {
      const { customer, product } = await fixture();
      const sale = await management.createWholesaleSale(
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
        actor,
      );
      const check = await finance.recordPayment(
        "sale",
        sale.id,
        {
          requestId: randomUUID(),
          method: "CHECK",
          amount: 20,
          check: {
            bankName: "QA bank",
            checkNumber: "456",
            dueDate: "2026-10-01",
          },
        },
        actor,
      );
      await management.updateOrderStatus(sale.id, "CANCELED", actor);
      await expect(
        finance.recordPayment(
          "sale",
          sale.id,
          { requestId: randomUUID(), method: "CASH", amount: 20 },
          actor,
        ),
      ).rejects.toThrow("ne peut pas");
      await expect(
        finance.updateCheck(check.id, { status: "CLEARED" }, actor),
      ).rejects.toThrow("déjà");
      expect(
        (
          await finance.checks(
            financeQuerySchema.parse({ search: sale.documentNumber }),
          )
        ).items[0]?.status,
      ).toBe("CANCELLED");
      await client.query(
        "UPDATE sales_orders SET channel='RETAIL_WEB',status='CONFIRMED' WHERE id=$1",
        [sale.id],
      );
      await expect(
        finance.recordPayment(
          "sale",
          sale.id,
          { requestId: randomUUID(), method: "CASH", amount: 20 },
          actor,
        ),
      ).rejects.toThrow("COD");
    });
    it("voids expenses with an audit trail, excludes them from totals and keeps pagination counts", async () => {
      const before = await dashboard.summary();
      const input = {
        requestId: randomUUID(),
        name: "QA finance expense",
        category: "RENT" as const,
        amount: 123.45,
        incurredOn: "2026-09-01",
        expenseType: "VARIABLE" as const,
        paymentMethod: "CASH" as const,
        notes: "QA reference",
      };
      const expense = await finance.createExpense(input, actor);
      expect(await finance.createExpense(input, actor)).toEqual(expense);
      expect(
        (await dashboard.summary()).expenses - before.expenses,
      ).toBeCloseTo(123.45);
      const empty = await finance.expenses(
        financeQuerySchema.parse({ search: "QA finance expense", page: 99 }),
      );
      expect(empty.total).toBe(1);
      expect(empty.items).toEqual([]);
      await finance.voidExpense(expense.id, "Erreur de saisie", actor);
      expect((await dashboard.summary()).expenses).toBe(before.expenses);
      const row = (
        await finance.expenses(
          financeQuerySchema.parse({ search: "QA finance expense" }),
        )
      ).items[0]!;
      expect(row.voidedAt).toBeTruthy();
      expect(row.voidReason).toBe("Erreur de saisie");
      await expect(
        finance.voidExpense(expense.id, "Second attempt", actor),
      ).rejects.toThrow("déjà");
    });
    it("creates each monthly fixed expense once on its configured day", async () => {
      const start = (
        await client.query<{ day: string }>(
          "SELECT (date_trunc('month',now() AT TIME ZONE 'Africa/Casablanca') - interval '2 months')::date::text AS day",
        )
      ).rows[0]!.day;
      await finance.createExpense(
        {
          requestId: randomUUID(),
          name: "Salaire récurrent QA",
          category: "SALARIES",
          amount: 5000,
          incurredOn: start,
          expenseType: "FIXED",
          paymentMethod: "CREDIT",
          recurringDay: 1,
          notes: "Génération mensuelle",
        },
        actor,
      );
      const query = financeQuerySchema.parse({
        search: "Salaire récurrent QA",
        pageSize: 100,
      });
      const occurrences = (await finance.expenses(query)).items;
      expect(occurrences).toHaveLength(3);
      expect((await finance.expenses(query)).items).toHaveLength(3);
      expect(
        (
          await client.query(
            "SELECT COUNT(*)::int AS count FROM recurring_expenses WHERE name='Salaire récurrent QA'",
          )
        ).rows[0].count,
      ).toBe(1);
      await finance.voidExpense(
        occurrences[0]!.id,
        "Arrêt de la charge fixe",
        actor,
      );
      expect(
        (
          await client.query(
            "SELECT active FROM recurring_expenses WHERE name='Salaire récurrent QA'",
          )
        ).rows[0].active,
      ).toBe(false);
    });
  },
);
