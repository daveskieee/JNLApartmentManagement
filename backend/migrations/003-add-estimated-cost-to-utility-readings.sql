-- Migration: Add estimated_cost column to utility_readings
ALTER TABLE utility_readings ADD COLUMN estimated_cost REAL DEFAULT 0;
