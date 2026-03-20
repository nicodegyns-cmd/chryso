-- Migration 012: Remove UNIQUE constraint on analytics.code
-- Allows multiple analytics with the same code

ALTER TABLE analytics DROP INDEX code;
