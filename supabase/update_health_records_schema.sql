-- Update Health Records table schema
-- Run this in Supabase SQL Editor if you already created the table with the old schema

-- Check if column exists, if not add it
DO $$
BEGIN
  -- Drop old boolean column if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'health_records' AND column_name = 'flu_shot_2025'
  ) THEN
    ALTER TABLE health_records DROP COLUMN flu_shot_2025;
  END IF;

  -- Add new date column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'health_records' AND column_name = 'flu_shot_last_date'
  ) THEN
    ALTER TABLE health_records ADD COLUMN flu_shot_last_date date;
  END IF;

  -- Ensure well_visit_last_date exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'health_records' AND column_name = 'well_visit_last_date'
  ) THEN
    ALTER TABLE health_records ADD COLUMN well_visit_last_date date;
  END IF;
END $$;

