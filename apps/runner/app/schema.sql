-- Triaige database schema.
-- Run on startup via CREATE TABLE IF NOT EXISTS — safe to re-run.

CREATE TABLE IF NOT EXISTS runs (
    run_id          TEXT PRIMARY KEY,
    created_at      TIMESTAMPTZ NOT NULL,
    total_failures  INTEGER NOT NULL,
    pr_title        TEXT,
    pr_url          TEXT,
    pr_number       INTEGER,
    repo            TEXT,
    triage_mode     TEXT,
    closed          BOOLEAN NOT NULL DEFAULT FALSE,
    classifications JSONB NOT NULL DEFAULT '{}',
    check_run_id    BIGINT
);

-- Migration: add pr_number column if missing (safe to re-run)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'runs' AND column_name = 'pr_number'
    ) THEN
        ALTER TABLE runs ADD COLUMN pr_number INTEGER;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS failure_results (
    run_id              TEXT NOT NULL REFERENCES runs(run_id) ON DELETE CASCADE,
    test_name           TEXT NOT NULL,
    snapshot_path       TEXT,
    group_names         JSONB,
    screenshot_baseline TEXT,
    screenshot_actual   TEXT,
    response            JSONB NOT NULL,
    PRIMARY KEY (run_id, test_name)
);

CREATE TABLE IF NOT EXISTS verdicts (
    run_id      TEXT NOT NULL,
    test_name   TEXT NOT NULL,
    verdict     TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (run_id, test_name),
    FOREIGN KEY (run_id, test_name) REFERENCES failure_results(run_id, test_name) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS submissions (
    run_id      TEXT NOT NULL,
    test_name   TEXT NOT NULL,
    url         TEXT NOT NULL,
    type        TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (run_id, test_name),
    FOREIGN KEY (run_id, test_name) REFERENCES failure_results(run_id, test_name) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS repo_settings (
    repo            TEXT PRIMARY KEY,
    pre_merge       BOOLEAN NOT NULL DEFAULT TRUE,
    post_merge      BOOLEAN NOT NULL DEFAULT TRUE,
    merge_gate      BOOLEAN NOT NULL DEFAULT TRUE
);

-- Migration: add check_run_id column to runs if missing (safe to re-run)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'runs' AND column_name = 'check_run_id'
    ) THEN
        ALTER TABLE runs ADD COLUMN check_run_id BIGINT;
    END IF;
END $$;

-- Migration: add merge_gate column to repo_settings if missing (safe to re-run)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'repo_settings' AND column_name = 'merge_gate'
    ) THEN
        ALTER TABLE repo_settings ADD COLUMN merge_gate BOOLEAN NOT NULL DEFAULT TRUE;
    END IF;
END $$;
