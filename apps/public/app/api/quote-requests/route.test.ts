import { describe, expect, it } from 'vitest';
import { GET, POST } from './route';

const ENQUIRY = {
  name: 'Latha Raman',
  phone: '+91 98401 55221',
  city: 'Coimbatore',
  policyType: 'health',
  sumInsured: 1_500_000,
  indicativePremium: 46_500,
};

function post(body: Record<string, unknown>): Request {
  return new Request('http://localhost:3000/api/quote-requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function messageFor(body: Record<string, unknown>): Promise<string> {
  const response = await POST(post(body));
  expect(response.status).toBe(422);
  const rejected = (await response.json()) as { message: string };
  return rejected.message;
}

describe('POST /api/quote-requests', () => {
  it('refuses an enquiry no broker could act on', async () => {
    expect(await messageFor({ ...ENQUIRY, name: '  ' })).toMatch(/who to ask for/);
    expect(await messageFor({ ...ENQUIRY, phone: 'call me' })).toMatch(/number we can call/);
    expect(await messageFor({ ...ENQUIRY, city: '' })).toMatch(/where the risk sits/);
    expect(await messageFor({ ...ENQUIRY, policyType: 'marine' })).toMatch(/cover we write/);
    expect(await messageFor({ ...ENQUIRY, sumInsured: 0 })).toMatch(/sum you want insured/);
  });

  it('records a complete enquiry and stamps it with a reference', async () => {
    const response = await POST(post(ENQUIRY));

    expect(response.status).toBe(201);
    const entry = (await response.json()) as { id: string; receivedAt: string; name: string };
    expect(entry.id).toMatch(/^ENQ-\d{4}$/);
    expect(entry.name).toBe('Latha Raman');
    expect(Number.isNaN(Date.parse(entry.receivedAt))).toBe(false);
  });

  it('hands what it recorded to the console, newest first', async () => {
    await POST(post({ ...ENQUIRY, name: 'Devika Rao', city: 'Madurai' }));

    const listed = (await GET().json()) as { name: string; city: string }[];

    expect(listed[0]).toMatchObject({ name: 'Devika Rao', city: 'Madurai' });
    expect(listed.some((entry) => entry.name === 'Latha Raman')).toBe(true);
  });
});
