-- Migration script to add new fields to existing tables
-- Run this after updating the schema.sql

-- Add priority field to existing tasks (default to medium)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS priority text DEFAULT 'medium' CHECK (priority IN ('low','medium','high'));

-- Add category and tags to existing notes
ALTER TABLE notes ADD COLUMN IF NOT EXISTS category text DEFAULT 'general';
ALTER TABLE notes ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';

-- Add category and is_active to existing subscriptions
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS category text DEFAULT 'entertainment';
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- Update existing tasks to have medium priority
UPDATE tasks SET priority = 'medium' WHERE priority IS NULL;

-- Update existing notes to have general category
UPDATE notes SET category = 'general' WHERE category IS NULL;

-- Update existing subscriptions to have entertainment category and be active
UPDATE subscriptions SET category = 'entertainment' WHERE category IS NULL;
UPDATE subscriptions SET is_active = true WHERE is_active IS NULL;
