-- analog DB init (local)
-- Assumes database "analog" already exists and you are connected to it.
--
-- IMPORTANT: Run migrations as analog_admin, otherwise default privileges won't apply

-- Roles
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'analog_admin') THEN
        CREATE ROLE analog_admin WITH LOGIN PASSWORD 'analog_admin_local';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'analog_app') THEN
        CREATE ROLE analog_app WITH LOGIN PASSWORD 'analog_app_local';
    END IF;
END $$;

-- Lock down database defaults
REVOKE ALL ON DATABASE analog FROM PUBLIC;
GRANT CONNECT ON DATABASE analog TO analog_admin, analog_app;
GRANT CREATE ON DATABASE analog TO analog_admin;

-- Lock down public schema (allow usage for tooling, but no object creation)
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO PUBLIC;

-- App schema (use this for all tables)
CREATE SCHEMA IF NOT EXISTS app AUTHORIZATION analog_admin;
ALTER SCHEMA app OWNER TO analog_admin;

-- Drizzle schema (for migration tracking)
CREATE SCHEMA IF NOT EXISTS drizzle AUTHORIZATION analog_admin;
ALTER SCHEMA drizzle OWNER TO analog_admin;

-- Schema privileges
GRANT USAGE, CREATE ON SCHEMA app TO analog_admin;
GRANT USAGE ON SCHEMA app TO analog_app;
GRANT USAGE, CREATE ON SCHEMA drizzle TO analog_admin;
REVOKE CREATE ON SCHEMA public FROM analog_app;

-- Ensure runtime role can use existing objects (if any)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA app TO analog_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA app TO analog_app;

-- Default privileges for future objects created by analog_admin
ALTER DEFAULT PRIVILEGES FOR ROLE analog_admin IN SCHEMA app
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO analog_app;

ALTER DEFAULT PRIVILEGES FOR ROLE analog_admin IN SCHEMA app
    GRANT USAGE, SELECT ON SEQUENCES TO analog_app;

ALTER DEFAULT PRIVILEGES FOR ROLE analog_admin IN SCHEMA app
    GRANT EXECUTE ON FUNCTIONS TO analog_app;

ALTER DEFAULT PRIVILEGES FOR ROLE analog_admin IN SCHEMA app
    GRANT USAGE ON TYPES TO analog_app;

-- Set search_path for both roles
ALTER ROLE analog_app SET search_path = app, pg_catalog;
ALTER ROLE analog_admin SET search_path = app, pg_catalog;

-- Operational timeouts for app role (prevent runaway queries and connection exhaustion)
ALTER ROLE analog_app SET statement_timeout = '30s';
ALTER ROLE analog_app SET idle_in_transaction_session_timeout = '60s';
ALTER ROLE analog_app SET lock_timeout = '5s';
