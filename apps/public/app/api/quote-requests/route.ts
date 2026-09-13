import { NextResponse } from 'next/server';
import { PRODUCTS, type Product } from '../../../lib/rates';

export const dynamic = 'force-dynamic';

export interface QuoteRequest {
  id: string;
  name: string;
  phone: string;
  city: string;
  policyType: Product;
  sumInsured: number;
  indicativePremium: number;
  receivedAt: string;
}

type QuoteRequestDraft = Omit<QuoteRequest, 'id' | 'receivedAt'>;

const PHONE = /^[+\d][\d\s().-]{6,}$/;
const KEEP = 10;
const received: QuoteRequest[] = [];
let sequence = 0;

function readDraft(body: Partial<QuoteRequest>): QuoteRequestDraft {
  return {
    name: (body.name ?? '').trim(),
    phone: (body.phone ?? '').trim(),
    city: (body.city ?? '').trim(),
    policyType: body.policyType as Product,
    sumInsured: Number(body.sumInsured),
    indicativePremium: Number(body.indicativePremium ?? 0),
  };
}

function problemWith(draft: QuoteRequestDraft): string | null {
  if (!draft.name) return 'Tell us who to ask for.';
  if (!PHONE.test(draft.phone)) return 'Leave a number we can call.';
  if (!draft.city) return 'Tell us where the risk sits.';
  if (!PRODUCTS.includes(draft.policyType)) return 'Pick a cover we write.';
  if (!(draft.sumInsured > 0)) return 'Enter the sum you want insured.';
  return null;
}

export function GET(): NextResponse<QuoteRequest[]> {
  return NextResponse.json(received);
}

export async function POST(request: Request): Promise<NextResponse> {
  const draft = readDraft((await request.json()) as Partial<QuoteRequest>);
  const problem = problemWith(draft);

  if (problem) return NextResponse.json({ message: problem }, { status: 422 });

  sequence += 1;
  const entry: QuoteRequest = {
    ...draft,
    id: `ENQ-${String(sequence).padStart(4, '0')}`,
    receivedAt: new Date().toISOString(),
  };

  received.unshift(entry);
  received.length = Math.min(received.length, KEEP);
  return NextResponse.json(entry, { status: 201 });
}
