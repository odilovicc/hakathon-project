ALTER TABLE goals ADD COLUMN evolution_awarded INTEGER NOT NULL DEFAULT 0;
UPDATE goals SET evolution_awarded = 1 WHERE status = 'done';
ALTER TABLE goal_events ADD COLUMN request_id TEXT;
CREATE UNIQUE INDEX goal_events_request ON goal_events(goal_id, request_id) WHERE request_id IS NOT NULL;
ALTER TABLE pet_costumes ADD COLUMN restore_active INTEGER NOT NULL DEFAULT 0;
