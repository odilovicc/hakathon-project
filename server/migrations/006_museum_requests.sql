ALTER TABLE museum ADD COLUMN request_id TEXT;
CREATE UNIQUE INDEX museum_request ON museum(user_id, request_id) WHERE request_id IS NOT NULL;
