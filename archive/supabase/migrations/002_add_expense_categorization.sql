-- Add expense categorization to essential_expenses
-- Version: 002
-- Adds expense_type (NEED/WANT) and category columns

ALTER TABLE essential_expenses 
ADD COLUMN IF NOT EXISTS expense_type VARCHAR(20) DEFAULT 'NEED' CHECK (expense_type IN ('NEED', 'WANT'));

ALTER TABLE essential_expenses 
ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'OTHER';

-- Add budget_amount for tracking planned vs actual
ALTER TABLE essential_expenses 
ADD COLUMN IF NOT EXISTS budget_amount DECIMAL(15, 2);

-- Add actual_amount for tracking real spending
ALTER TABLE essential_expenses 
ADD COLUMN IF NOT EXISTS actual_amount DECIMAL(15, 2) DEFAULT 0;

-- Update existing rows to set budget_amount = amount (for backward compatibility)
UPDATE essential_expenses SET budget_amount = amount WHERE budget_amount IS NULL;

-- Add description/source to income_events
ALTER TABLE income_events 
ADD COLUMN IF NOT EXISTS source VARCHAR(100) DEFAULT 'Salario';
