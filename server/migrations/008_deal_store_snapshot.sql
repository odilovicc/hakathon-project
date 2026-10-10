ALTER TABLE deal_logs ADD COLUMN store_name TEXT;
UPDATE deal_logs SET store_name = (SELECT name FROM stores WHERE stores.id = deal_logs.store_id);
