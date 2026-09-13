import { Suspense } from 'react';
import { describe, expect, it } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import QuoteForm from './QuoteForm';
import type { RateCard } from '../../lib/rates';

const CARD: RateCard = {
  publishedAt: '2026-09-13T10:00:00.000Z',
  perMille: { motor: 24.5, health: 31, property: 4.5, life: 6.4 },
};

interface PendingCard {
  rateCard: Promise<RateCard>;
  publish: (card: RateCard) => void;
}

function pendingCard(): PendingCard {
  let publish: (card: RateCard) => void = () => undefined;
  const rateCard = new Promise<RateCard>((resolve) => {
    publish = resolve;
  });
  return { rateCard, publish };
}

async function mount(rateCard: Promise<RateCard>): Promise<void> {
  await act(async () => {
    render(
      <Suspense fallback={<p>Loading this hour&rsquo;s rates…</p>}>
        <QuoteForm rateCard={rateCard} />
      </Suspense>,
    );
  });
}

describe('QuoteForm', () => {
  it('suspends on the rate card the server passed it, then prices off it', async () => {
    const { rateCard, publish } = pendingCard();

    await mount(rateCard);
    expect(screen.getByText(/Loading this hour/)).toBeTruthy();
    expect(screen.queryByLabelText('Cover')).toBeNull();

    await act(async () => {
      publish(CARD);
      await rateCard;
    });

    expect(screen.getByText('₹12,250')).toBeTruthy();
    expect(screen.getByText(/24\.5 per ₹1,000 insured/)).toBeTruthy();
  });

  it('reprices when the applicant changes the term and the cover', async () => {
    const user = userEvent.setup();
    await mount(Promise.resolve(CARD));

    expect(screen.getByText('₹12,250')).toBeTruthy();

    await user.selectOptions(screen.getByLabelText('Term'), '24');
    expect(screen.getByText('₹11,640')).toBeTruthy();

    await user.selectOptions(screen.getByLabelText('Cover'), 'property');
    expect(screen.getByText('₹2,140')).toBeTruthy();
  });
});
