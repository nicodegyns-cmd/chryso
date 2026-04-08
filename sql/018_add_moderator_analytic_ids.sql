-- Migration 018: Add moderator_analytic_ids to users table
-- Stores comma-separated analytic IDs that a moderator is restricted to
ALTER TABLE users ADD COLUMN IF NOT EXISTS moderator_analytic_ids TEXT DEFAULT NULL;
