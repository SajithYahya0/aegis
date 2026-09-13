import { useRef, useState, type ReactElement } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert, Button, Card, CardContent, Stack, Step, StepLabel, Stepper, Typography,
} from '@mui/material';
import { IncidentFields, INCIDENT_FIELDS, type IncidentFieldsHandle } from './IncidentFields';
import {
  CLAIM_TYPE_LABEL, EMPTY_CLAIM, claimSchema, formatRupees,
  type ClaimFormValues, type PolicyOption,
} from './claimSchema';

export interface ClaimIntakeProps {
  policies: readonly PolicyOption[];
  initialPolicyId?: string;
  onFile: (draft: ClaimFormValues) => Promise<{ id: string }>;
}

export default function ClaimIntake({
  policies,
  initialPolicyId = '',
  onFile,
}: ClaimIntakeProps): ReactElement {
  const [onReview, setOnReview] = useState(false);
  const [filedId, setFiledId] = useState<string | null>(null);
  const fieldsRef = useRef<IncidentFieldsHandle>(null);

  const { control, handleSubmit, trigger, getValues, setError, reset, formState } =
    useForm<ClaimFormValues>({
      resolver: zodResolver(claimSchema),
      mode: 'onBlur',
      defaultValues: { ...EMPTY_CLAIM, policyId: initialPolicyId },
    });

  async function goToReview(): Promise<void> {
    if (await trigger(INCIDENT_FIELDS.slice())) setOnReview(true);
    else fieldsRef.current?.focusFirstInvalid();
  }

  const onSubmit = handleSubmit(async (values) => {
    try {
      const filed = await onFile(values);
      setFiledId(filed.id);
      setOnReview(false);
      reset(EMPTY_CLAIM as ClaimFormValues);
    } catch (thrown) {
      setOnReview(false);
      setError('root.server', {
        message: thrown instanceof Error ? thrown.message : 'The claim could not be filed.',
      });
    }
  });

  const values = getValues();

  return (
    <Stack component="form" onSubmit={onSubmit} noValidate spacing={2}>
      <Stepper activeStep={onReview ? 1 : 0}>
        <Step><StepLabel>Incident</StepLabel></Step>
        <Step><StepLabel>Review</StepLabel></Step>
      </Stepper>
      {filedId ? (
        <Alert severity="success">Claim {filedId} filed. It is listed on the dashboard.</Alert>
      ) : null}
      {formState.errors.root?.server ? (
        <Alert severity="error">{formState.errors.root.server.message}</Alert>
      ) : null}
      <Card>
        <CardContent>
          {onReview ? (
            <Stack spacing={1}>
              <Typography variant="body1">
                {values.policyId} · {CLAIM_TYPE_LABEL[values.type]} ·{' '}
                {formatRupees(values.amount)}
              </Typography>
              <Typography variant="body2">
                {values.incidentDate} · {values.claimantPhone}
              </Typography>
              <Typography variant="body2">{values.description}</Typography>
            </Stack>
          ) : (
            <IncidentFields ref={fieldsRef} control={control} policies={policies} />
          )}
        </CardContent>
      </Card>
      <Stack direction="row" spacing={1}>
        {onReview ? (
          <>
            <Button onClick={() => setOnReview(false)}>Back</Button>
            <Button type="submit" variant="contained" disabled={formState.isSubmitting}>
              {formState.isSubmitting ? 'Filing…' : 'File claim'}
            </Button>
          </>
        ) : (
          <Button variant="contained" onClick={goToReview}>Review</Button>
        )}
      </Stack>
    </Stack>
  );
}
