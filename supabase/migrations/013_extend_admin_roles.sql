-- Extend admin_role enum with additional staff roles

ALTER TYPE admin_role ADD VALUE IF NOT EXISTS 'ANALYST';
