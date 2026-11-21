ALTER TABLE tasks ADD COLUMN series_start TEXT;

UPDATE tasks SET series_start = due_local WHERE recurrence_rule IS NOT NULL;

INSERT INTO schema_migrations(version, applied_at)
VALUES (2, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));

PRAGMA user_version = 2;
