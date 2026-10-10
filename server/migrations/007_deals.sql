CREATE TABLE deal_comparisons (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  result_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX deal_comparisons_user ON deal_comparisons(user_id, created_at);
ALTER TABLE deal_logs ADD COLUMN comparison_id TEXT REFERENCES deal_comparisons(id);
ALTER TABLE deal_logs ADD COLUMN request_id TEXT;
ALTER TABLE deal_logs ADD COLUMN currency TEXT;
ALTER TABLE deal_logs ADD COLUMN goal_event_id INTEGER REFERENCES goal_events(id);
CREATE UNIQUE INDEX deal_logs_request ON deal_logs(user_id, request_id) WHERE request_id IS NOT NULL;
CREATE UNIQUE INDEX deal_logs_comparison ON deal_logs(user_id, comparison_id, store_id) WHERE comparison_id IS NOT NULL;
