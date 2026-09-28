-- Settings for this database only, picked up by new connections.
-- JIT compiles queries the planner thinks are big, which costs more than our
-- short queries take to run. A random_page_cost of 1.1 tells the planner that
-- reads are cheap, as they are on SSDs, so it uses indexes instead of reading
-- whole tables. In a test with 1.25 million collection items, they made the
-- collections list about 6 times faster.
DO $$
BEGIN
    EXECUTE format('ALTER DATABASE %I SET jit = off', current_database());
    EXECUTE format('ALTER DATABASE %I SET random_page_cost = 1.1', current_database());
END
$$;
