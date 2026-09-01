-- Optional reference data for local development.
-- Safe to re-run: every insert is idempotent on the natural key.
-- It deliberately contains NO user accounts — create the first administrator by
-- registering through the UI while BOOTSTRAP_ADMIN is "true".

INSERT INTO branches (id, name, code, city, country, budget, created_at, updated_at)
SELECT 'b1000000-0000-4000-8000-000000000001', 'Head Office', 'HQ', 'Lagos', 'Nigeria', 500000, datetime('now'), datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM branches WHERE code = 'HQ');

INSERT INTO branches (id, name, code, city, country, budget, created_at, updated_at)
SELECT 'b1000000-0000-4000-8000-000000000002', 'Abuja Depot', 'ABJ', 'Abuja', 'Nigeria', 180000, datetime('now'), datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM branches WHERE code = 'ABJ');

INSERT INTO departments (id, name, code, branch_id, budget, created_at, updated_at)
SELECT 'd1000000-0000-4000-8000-000000000001', 'IT Operations', 'ITOPS',
       (SELECT id FROM branches WHERE code = 'HQ' LIMIT 1), 120000, datetime('now'), datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM departments WHERE code = 'ITOPS');

INSERT INTO departments (id, name, code, branch_id, budget, created_at, updated_at)
SELECT 'd1000000-0000-4000-8000-000000000002', 'Finance', 'FIN',
       (SELECT id FROM branches WHERE code = 'HQ' LIMIT 1), 90000, datetime('now'), datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM departments WHERE code = 'FIN');
