declare module 'claims/ClaimIntake' {
  import type { ComponentType } from 'react';

  export interface ClaimIntakeDraft {
    policyId: string;
    type: import('./shared/domain').ClaimType;
    amount: number;
    incidentDate: string;
    claimantPhone: string;
    description: string;
  }

  export interface ClaimIntakeProps {
    policies: readonly { id: string; customerName: string; sumInsured: number }[];
    initialPolicyId?: string;
    onFile: (draft: ClaimIntakeDraft) => Promise<{ id: string }>;
  }

  const ClaimIntake: ComponentType<ClaimIntakeProps>;

  export default ClaimIntake;
}
