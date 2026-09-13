import { useState, type ReactElement } from 'react';
import {
  Alert, Button, Card, CardContent, Stack, Step, StepLabel, Stepper, Typography,
} from '@mui/material';
import { annualPremium } from '../shared/rating';
import { QUOTE_STEPS, QuoteProvider, useQuote } from './QuoteContext';
import type { QuoteDraft, QuoteStep } from './QuoteContext';
import { ApplicantStep, CoverageStep, ReviewStep, RiskStep } from './QuoteSteps';
import { StickyPremiumSummary } from './StickyPremiumSummary';

const STEP_LABEL: Record<QuoteStep, string> = {
  applicant: 'Applicant',
  risk: 'Risk',
  coverage: 'Coverage',
  review: 'Review',
};

function validate(draft: QuoteDraft): string | null {
  if (draft.step === 'applicant') {
    if (!draft.city.trim()) return 'Enter the city where the risk sits.';
    if (draft.insured.length === 0) return 'Add at least one insured party.';
    const incomplete = draft.insured.findIndex(
      (party) => !party.fullName.trim() || !party.dateOfBirth,
    );
    if (incomplete >= 0) return `Complete the details for insured party ${incomplete + 1}.`;
  }
  if (draft.step === 'risk') {
    if (!(draft.sumInsured > 0)) return 'Enter a sum insured greater than zero.';
    if (!(draft.priorClaims >= 0)) return 'Prior claims cannot be negative.';
  }
  return null;
}

export default function QuoteWizardPage(): ReactElement {
  return (
    <QuoteProvider>
      <QuoteWizard />
    </QuoteProvider>
  );
}

function QuoteWizard(): ReactElement {
  const { draft, dispatch } = useQuote();
  const [stepError, setStepError] = useState<string | null>(null);
  const stepIndex = QUOTE_STEPS.indexOf(draft.step);

  const premium = annualPremium({
    type: draft.type,
    sumInsured: draft.sumInsured,
    termMonths: draft.termMonths,
    priorClaims: draft.priorClaims,
    optionalCovers: draft.optionalCoverageCodes.length,
  });

  function goNext(): void {
    const problem = validate(draft);
    setStepError(problem);
    if (!problem) dispatch({ type: 'next' });
  }

  function goBack(): void {
    setStepError(null);
    dispatch({ type: 'back' });
  }

  return (
    <>
      <Typography variant="h1">New quote</Typography>
      <Stepper activeStep={stepIndex}>
        {QUOTE_STEPS.map((step) => (
          <Step key={step}>
            <StepLabel>{STEP_LABEL[step]}</StepLabel>
          </Step>
        ))}
      </Stepper>
      <Card>
        <CardContent>
          <Stack spacing={2}>
            {draft.step === 'applicant' ? <ApplicantStep /> : null}
            {draft.step === 'risk' ? <RiskStep /> : null}
            {draft.step === 'coverage' ? <CoverageStep /> : null}
            {draft.step === 'review' ? <ReviewStep /> : null}
            {stepError ? <Alert severity="warning">{stepError}</Alert> : null}
          </Stack>
        </CardContent>
      </Card>
      <Stack direction="row" spacing={1}>
        <Button disabled={stepIndex === 0} onClick={goBack}>
          Back
        </Button>
        <Button
          variant="contained"
          disabled={stepIndex === QUOTE_STEPS.length - 1}
          onClick={goNext}
        >
          Next
        </Button>
      </Stack>
      <StickyPremiumSummary premium={premium} />
    </>
  );
}
