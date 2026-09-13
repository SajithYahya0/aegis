import { useMemo, type ReactElement } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Alert, Button, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { submitDecision, type Decision } from '../shared/http/client';
import { formatCurrency } from '../shared/domain';
import type { Policy } from '../shared/domain';

const DECISION_OUTCOMES = ['accept', 'refer', 'decline'] as const;

const DECISION_LABEL: Record<(typeof DECISION_OUTCOMES)[number], string> = {
  accept: 'Accept at the quoted rate',
  refer: 'Refer to the treaty underwriter',
  decline: 'Decline the risk',
};

const MIN_NOTE_CHARS = 20;

function makeDecisionSchema(maxLoadingPct: number) {
  return z.object({
    policyId: z.string().min(1, 'Pick a policy from the referral queue.'),
    outcome: z.enum(DECISION_OUTCOMES),
    loadingPct: z
      .number({ error: 'Enter a rate loading, or 0 for none.' })
      .min(0, 'A rate loading cannot be negative.')
      .max(maxLoadingPct, `${maxLoadingPct}% is the most you may load on your own authority.`),
    note: z
      .string()
      .trim()
      .min(MIN_NOTE_CHARS, `Record the reasoning in at least ${MIN_NOTE_CHARS} characters.`),
  });
}

type DecisionValues = z.infer<ReturnType<typeof makeDecisionSchema>>;

const BLANK: DecisionValues = { policyId: '', outcome: 'refer', loadingPct: 0, note: '' };

export interface UnderwritingDecisionFormProps {
  queue: readonly Policy[];
  maxLoadingPct: number;
  onRecorded: (decision: Decision) => void;
}

export function UnderwritingDecisionForm({
  queue,
  maxLoadingPct,
  onRecorded,
}: UnderwritingDecisionFormProps): ReactElement {
  const schema = useMemo(() => makeDecisionSchema(maxLoadingPct), [maxLoadingPct]);
  const { control, handleSubmit, reset, setError, formState } = useForm<DecisionValues>({
    resolver: zodResolver(schema),
    mode: 'onBlur',
    defaultValues: BLANK,
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      onRecorded(await submitDecision(values));
      reset(BLANK);
    } catch (thrown) {
      setError('root.server', {
        message: thrown instanceof Error ? thrown.message : 'The decision could not be recorded.',
      });
    }
  });

  return (
    <Stack component="form" onSubmit={onSubmit} noValidate spacing={2}>
      <Typography variant="h2">Record a decision</Typography>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <Controller
          name="policyId"
          control={control}
          render={({ field, fieldState }) => (
            <TextField
              {...field}
              select
              label="Policy"
              sx={{ minWidth: 240 }}
              error={Boolean(fieldState.error)}
              helperText={fieldState.error?.message ?? `${queue.length} in the queue`}
            >
              {queue.map((policy) => (
                <MenuItem key={policy.id} value={policy.id}>
                  {policy.id} · {formatCurrency(policy.sumInsured)}
                </MenuItem>
              ))}
            </TextField>
          )}
        />
        <Controller
          name="outcome"
          control={control}
          render={({ field }) => (
            <TextField {...field} select label="Decision" sx={{ minWidth: 240 }}>
              {DECISION_OUTCOMES.map((value) => (
                <MenuItem key={value} value={value}>{DECISION_LABEL[value]}</MenuItem>
              ))}
            </TextField>
          )}
        />
        <Controller
          name="loadingPct"
          control={control}
          render={({ field, fieldState }) => (
            <TextField
              {...field}
              type="number"
              label="Rate loading (%)"
              value={field.value ?? ''}
              onChange={(event) =>
                field.onChange(event.target.value === '' ? undefined : Number(event.target.value))
              }
              error={Boolean(fieldState.error)}
              helperText={fieldState.error?.message ?? `Your authority: ${maxLoadingPct}%`}
            />
          )}
        />
      </Stack>
      <Controller
        name="note"
        control={control}
        render={({ field, fieldState }) => (
          <TextField
            {...field}
            fullWidth
            multiline
            minRows={2}
            label="Underwriting note"
            error={Boolean(fieldState.error)}
            helperText={fieldState.error?.message ?? 'Recorded against the policy for audit.'}
          />
        )}
      />
      {formState.errors.root?.server ? (
        <Alert severity="error">{formState.errors.root.server.message}</Alert>
      ) : null}
      <Button
        type="submit"
        variant="contained"
        sx={{ alignSelf: 'flex-start' }}
        disabled={formState.isSubmitting}
      >
        {formState.isSubmitting ? 'Recording…' : 'Record decision'}
      </Button>
    </Stack>
  );
}
