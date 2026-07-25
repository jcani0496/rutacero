-- Add debt goal fields for PRO users
ALTER TABLE debts
ADD COLUMN IF NOT EXISTS goal_extra_payment DECIMAL(15, 2) NOT NULL DEFAULT 0;

ALTER TABLE debts
ADD COLUMN IF NOT EXISTS goal_target_date DATE;
