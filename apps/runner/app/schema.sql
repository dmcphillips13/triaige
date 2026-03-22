-- Triaige database schema.
-- Run on startup via CREATE TABLE IF NOT EXISTS — safe to re-run.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

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

-- Known failures: tests currently broken on main with open GitHub issues.
-- Populated when issues are filed via /create-issues. Closed from dashboard UI.
CREATE TABLE IF NOT EXISTS known_failures (
    id                  SERIAL PRIMARY KEY,
    repo                TEXT NOT NULL,
    test_name           TEXT NOT NULL,
    issue_url           TEXT NOT NULL,
    issue_number        INTEGER NOT NULL,
    screenshot_base64   TEXT,
    filed_from_run_id   TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at           TIMESTAMPTZ,
    UNIQUE(repo, test_name, issue_number)
);

-- Pending issues: deferred issue creation for pre-merge runs.
-- Issues are recorded at submit time but only materialized (GitHub issue created,
-- known_failures populated) when the PR merges to main via /report-clean.
CREATE TABLE IF NOT EXISTS pending_issues (
    id                SERIAL PRIMARY KEY,
    run_id            TEXT NOT NULL,
    repo              TEXT NOT NULL,
    pr_number         INTEGER NOT NULL,
    test_name         TEXT NOT NULL,
    classification    TEXT,
    confidence        REAL,
    rationale         TEXT,
    screenshot_base64 TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    materialized_at   TIMESTAMPTZ,
    issue_url         TEXT,
    UNIQUE(run_id, test_name)
);

-- Migration: add screenshot_baseline to known_failures if missing (safe to re-run)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'known_failures' AND column_name = 'screenshot_baseline'
    ) THEN
        ALTER TABLE known_failures ADD COLUMN screenshot_baseline TEXT;
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

-- Migration: add api_key column to repo_settings if missing (safe to re-run)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'repo_settings' AND column_name = 'api_key'
    ) THEN
        ALTER TABLE repo_settings ADD COLUMN api_key TEXT;
    END IF;
END $$;

-- Migration: fix repo_settings rows where pre_merge is FALSE due to missing
-- explicit values in the original get_or_create_api_key INSERT (safe to re-run)
UPDATE repo_settings SET pre_merge = TRUE WHERE pre_merge = FALSE;

-- Migration: add failure_type column to failure_results if missing (safe to re-run)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'failure_results' AND column_name = 'failure_type'
    ) THEN
        ALTER TABLE failure_results ADD COLUMN failure_type TEXT;
    END IF;
END $$;

-- Migration: add encrypted OpenAI API key column to repo_settings (BYOK support)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'repo_settings' AND column_name = 'openai_api_key_encrypted'
    ) THEN
        ALTER TABLE repo_settings ADD COLUMN openai_api_key_encrypted BYTEA;
    END IF;
END $$;
