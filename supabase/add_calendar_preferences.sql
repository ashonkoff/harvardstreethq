-- Add default_calendar_ids column to profiles table
-- This stores each user's preferred calendar selections as a JSON array

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS default_calendar_ids text[] DEFAULT NULL;

-- Add a comment to document the column
COMMENT ON COLUMN profiles.default_calendar_ids IS 'Array of Google Calendar IDs that the user has selected as their default calendars';

