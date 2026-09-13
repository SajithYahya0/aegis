import { describe, expect, it } from 'vitest';
import { claimSchema, todayIso } from './claimSchema';

const VALID_CLAIM = {
  policyId: 'POL-1001',
  type: 'accident' as const,
  amount: 45_000,
  incidentDate: '2024-01-15',
  claimantPhone: '+91 98400 12345',
  description: 'Rear-ended at a signal; the bumper and boot lid need replacing.',
};

function messagesFor(claim: Record<string, unknown>): Record<string, string> {
  const result = claimSchema.safeParse(claim);
  if (result.success) return {};
  return Object.fromEntries(result.error.issues.map((i) => [String(i.path[0]), i.message]));
}

describe('claimSchema', () => {
  it('accepts a complete first notice of loss, including one reported today', () => {
    expect(claimSchema.safeParse(VALID_CLAIM).success).toBe(true);
    expect(claimSchema.safeParse({ ...VALID_CLAIM, incidentDate: todayIso() }).success).toBe(true);
  });

  it('refuses a loss the insurer could not act on', () => {
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    const messages = messagesFor({
      ...VALID_CLAIM, policyId: '', amount: 0, incidentDate: tomorrow,
      claimantPhone: 'call me', description: 'Bumped it.',
    });

    expect(messages.policyId).toMatch(/Select the policy/);
    expect(messages.amount).toMatch(/greater than zero/);
    expect(messages.incidentDate).toMatch(/cannot be in the future/);
    expect(messages.claimantPhone).toMatch(/phone number/);
    expect(messages.description).toMatch(/at least 20 characters/);
  });
});
