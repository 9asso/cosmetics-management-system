-- Selective Database Reset Script
-- Preserves: customers, suppliers, expenses, recurring_expenses, payments, checks, organizations, locations, users
-- Resets: products, product_variants, inventory, sales_orders, purchase_orders, returns, document_history

BEGIN;

-- 1. Preserve order numbers in payments before unlinking
UPDATE payments p
SET reference = COALESCE(p.reference, s.order_number)
FROM sales_orders s
WHERE p.sales_order_id = s.id AND (p.reference IS NULL OR p.reference = '');

UPDATE payments p
SET reference = COALESCE(p.reference, s.order_number)
FROM purchase_orders s
WHERE p.purchase_order_id = s.id AND (p.reference IS NULL OR p.reference = '');

-- 2. Unlink foreign keys in payments and clear payment_allocations
DELETE FROM payment_allocations;
UPDATE payments SET sales_order_id = NULL, purchase_order_id = NULL;

-- 3. Delete commercial orders, returns, and history
DELETE FROM return_items;
DELETE FROM returns;
DELETE FROM sales_order_items;
DELETE FROM sales_orders;
DELETE FROM purchase_order_items;
DELETE FROM purchase_orders;
DELETE FROM document_history;

-- 4. Delete inventory
DELETE FROM inventory_movements;
DELETE FROM inventory_balances;
DELETE FROM inventory_lots;

-- 5. Delete products and variants
DELETE FROM product_supplier_links;
DELETE FROM product_units;
DELETE FROM product_images;
DELETE FROM product_media_assets;
DELETE FROM product_variants;
DELETE FROM products;

-- 6. Clear catalog audit logs
DELETE FROM audit_logs;

COMMIT;
