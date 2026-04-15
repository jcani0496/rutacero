-- Add category/detail field to debts for more granular labeling
ALTER TABLE debts
ADD COLUMN IF NOT EXISTS category VARCHAR(50);
