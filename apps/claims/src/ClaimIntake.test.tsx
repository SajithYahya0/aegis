import {fireEvent, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, vi, it} from 'vitest';
import ClaimIntake from './ClaimIntake';

describe('ClaimIntake', () => {
    it('blocks an invalid from reaching review', async () => {
        const user = userEvent.setup();
        render(<ClaimIntake policies={[]} onFile={vi.fn()} />);

        await user.click(screen.getByRole('button', {name: 'Review'}));

        await screen.findByText(/at least 20 characters/);
        screen.getByLabelText(/What happened/);
    });

    it('files a claim once every field is valid', async () => {
        const user = userEvent.setup();
        const onFile = vi.fn().mockResolvedValue({id: 'CLM-TEST'});
        render(
            <ClaimIntake
                policies={[{id: 'POL-1', customerName: 'Priya Nair', sumInsured: 500000}]}
                onFile={onFile}
            />,
        );

        await user.click(screen.getByRole('combobox', {name: 'Policy'}));
        await user.click(await screen.findByRole('option', {name: /POL-1/}));
        await user.click(screen.getByRole('combobox', {name: 'Claim type'}));
        await user.click(await screen.findByRole('option', {name: 'Theft'}));
        await user.type(screen.getByLabelText('Amount claimed (₹)'), '45000');
        fireEvent.change(screen.getByLabelText('Date of incident'), {
            target: {value: '2026-01-15'},
        });
        await user.type(screen.getByLabelText('Claimant phone'), '9876543210');
        await user.type(
            screen.getByLabelText(/What happened/),
            'The car was stolen from the office car park overnight.',
        );

        await user.click(screen.getByRole('button', {name: 'Review'}));
        await user.click(await screen.findByRole('button', {name: 'File claim'}));

        await screen.findByText(/Claim CLM-TEST filed\./);
        expect(onFile).toHaveBeenCalledTimes(1);
    });
});
