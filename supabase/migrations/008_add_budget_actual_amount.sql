-- Add actual spend tracking for variable budget targets
ALTER TABLE variable_budget_targets
ADD COLUMN IF NOT EXISTS actual_amount DECIMAL(15, 2) NOT NULL DEFAULT 0;
