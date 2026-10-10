ALTER TABLE museum ADD COLUMN goal_event_id INTEGER REFERENCES goal_events(id);
ALTER TABLE subscriptions ADD COLUMN transfer_event_id INTEGER REFERENCES goal_events(id);
ALTER TABLE transactions ADD COLUMN subscription_id INTEGER REFERENCES subscriptions(id) ON DELETE SET NULL;
CREATE INDEX transactions_subscription ON transactions(subscription_id);
