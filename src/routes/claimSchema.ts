import { z } from 'zod';
import { CLAIM_TYPES } from '../shared/domain';

export const MIN_DESCRIPTION_CHARS = 20;

const PHONE = /^[+\d][\d\s().-]{6,}$/;

export function todayIso(): string {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

export const claimSchema = z.object({
  policyId: z.string().min(1, 'Select the policy this claim is filed against.'),
  type: z.enum(CLAIM_TYPES),
  amount: z
    .number({ error: 'Enter the amount claimed, in rupees.' })
    .positive('The amount claimed must be greater than zero.'),
  incidentDate: z
    .string()
    .min(1, 'Enter the date of the incident.')
    .refine((value) => value <= todayIso(), 'The incident date cannot be in the future.'),
  claimantPhone: z
    .string()
    .trim()
    .regex(PHONE, 'Enter a phone number the claimant can be reached on.'),
  description: z
    .string()
    .trim()
    .min(
      MIN_DESCRIPTION_CHARS,
      `Describe the loss in at least ${MIN_DESCRIPTION_CHARS} characters.`,
    ),
});

export type ClaimFormValues = z.infer<typeof claimSchema>;

export const EMPTY_CLAIM: Omit<ClaimFormValues, 'amount'> = {
  policyId: '',
  type: 'accident',
  incidentDate: '',
  claimantPhone: '',
  description: '',
};
