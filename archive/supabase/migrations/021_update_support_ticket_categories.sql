-- Align support_tickets category constraint with app enums

ALTER TABLE support_tickets
    DROP CONSTRAINT IF EXISTS support_tickets_category_check;

ALTER TABLE support_tickets
    ADD CONSTRAINT support_tickets_category_check
    CHECK (category::text = ANY (ARRAY[
        'BILLING',
        'ACCESS',
        'BUG',
        'DATA',
        'FEATURE_REQUEST',
        'OTHER',
        'TECHNICAL',
        'ACCOUNT'
    ]));
