-- Triaige database schema.
-- Run on startup via CREATE TABLE IF NOT EXISTS — safe to re-run.

CREATE TABLE IF NOT EXISTS runs (
    run_id          TEXT PRIMARY KEY,
    created_at      TIMESTAMPTZ NOT NULL,
    total_failures  INTEGER NOT NULL,
    pr_title        TEXT,
    pr_url          TEXT,
    repo            TEXT,
    triage_mode     TEXT,
    closed          BOOLEAN NOT NULL DEFAULT FALSE,
    classifications JSONB NOT NULL DEFAULT '{}'
);

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
    repo        TEXT PRIMARY KEY,
    pre_merge   BOOLEAN NOT NULL DEFAULT FALSE,
    post_merge  BOOLEAN NOT NULL DEFAULT TRUE
);
