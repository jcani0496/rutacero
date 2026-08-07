import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Checkbox } from './checkbox';

describe('Checkbox', () => {
    it('calls onCheckedChange with the toggled value', () => {
        const onCheckedChange = vi.fn();

        render(
            <Checkbox
                aria-label="Accept terms"
                checked={false}
                onCheckedChange={onCheckedChange}
            />,
        );

        fireEvent.click(screen.getByRole('checkbox', { name: /accept terms/i }));

        expect(onCheckedChange).toHaveBeenCalledWith(true);
    });
});
