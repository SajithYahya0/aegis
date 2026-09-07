/**
 * WHY THIS EXISTS:
 *   The write half of `/underwriting`: record a decision against one policy in
 *   the referral queue. `react-hook-form` + `zodResolver` over the schema
 *   factory in `decisionSchema.ts`, posting through the axios client.
 *
 *   It is a separate component from `UnderwritingPage` for one reason worth
 *   stating: `useForm` re-renders its owner on every `formState` transition
 *   this form subscribes to. Inlined into the page, each of those would
 *   re-render the referral table and the exposure roll-up beside it —
 *   `selectExposureByCustomer` is memoised so it would not recompute, but the
 *   140-row table below would rebuild its elements on every keystroke that
 *   flips an error on or off. The boundary is what keeps the form's renders
 *   inside the form.
 *
 * CONCEPTS: W4-D5-01, W4-D5-02, W4-D5-03, W4-D1-02, W4-D2-05
 *
 * WITHOUT THIS:
 *   The queue is a read-only list, and `/underwriting` demonstrates three of
 *   the four Week 4 topics rather than four — there is no form on the page
 *   that theming, the transport and the store all meet inside.
 *
 *   NO SCHEMA FACTORY — see `decisionSchema.ts`. The cap this form enforces is
 *   the one the *server* stated in `GET /underwriting/limits`, which is why
 *   `maxLoadingPct` is a prop and not a constant.
 *
 *   NO `reset()` AFTER A SUCCESSFUL POST: the fields keep the decision that
 *   was just filed, `isDirty` stays true, and the next policy selected inherits
 *   the previous one's note — which is how an audit trail ends up saying the
 *   same thing about four unrelated risks. `reset()` also puts `isDirty` back
 *   to false, which re-arms the `!isDirty` guard on the submit button; without
 *   it the button stays live and a second click re-files the same decision.
 *
 *   NO `root.server` ERROR SLOT: the endpoint has its own, shorter note
 *   minimum (`mockBackend.ts`), and it will 422 a submission this form was
 *   happy with if the two ever disagree. `setError('root.server', …)` is
 *   where that lands. A field-level path would be wrong — the client has no
 *   basis for deciding *which* field the server objected to — and a local
 *   `useState` would not be cleared by the next submit the way RHF clears
 *   `root` errors automatically.
 */

import { useMemo, type ReactElement } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid2';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { submitUnderwritingDecision, type UnderwritingDecision } from '../../shared/http/endpoints';
import { formatCurrency } from '../../shared/format';
import type { Policy } from '../../shared/types';
import {
  DECISION_LABEL,
  DECISION_OUTCOMES,
  makeDecisionSchema,
  type DecisionValues,
} from './decisionSchema';

export interface DecisionFormProps {
  /** The policies the queue is currently offering a decision on. */
  queue: readonly Policy[];
  /** The authority cap the server stated. Drives the schema — see the header. */
  maxLoadingPct: number;
  onRecorded: (decision: UnderwritingDecision) => void;
}

export function DecisionForm({
  queue,
  maxLoadingPct,
  onRecorded,
}: DecisionFormProps): ReactElement {
  /*
   * The schema is rebuilt only when the cap changes. Without the memo, every
   * render of this component constructs a new schema object, `zodResolver`
   * wraps a new resolver around it, and `useForm` is handed a different
   * `resolver` identity each time — which is not fatal, but it does discard
   * RHF's ability to skip work it has already done and makes the resolver the
   * one input to this form that is never stable.
   */
  const schema = useMemo(() => makeDecisionSchema(maxLoadingPct), [maxLoadingPct]);

  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting, isDirty, isValid },
  } = useForm<DecisionValues>({
    resolver: zodResolver(schema),
    mode: 'onBlur',
    reValidateMode: 'onChange',
    defaultValues: { policyId: '', outcome: 'refer', note: '' },
  });

  const onValid = handleSubmit(async (values: DecisionValues) => {
    try {
      const decision = await submitUnderwritingDecision(values);
      onRecorded(decision);
      // Back to a pristine form: see the header for why this is not optional.
      reset({ policyId: '', outcome: 'refer', note: '' });
    } catch (thrown) {
      setError('root.server', {
        message:
          thrown instanceof Error && thrown.message
            ? thrown.message
            : 'The decision could not be recorded.',
      });
    }
  });

  const serverError = errors.root?.server?.message;

  return (
    <Box component="form" onSubmit={onValid} noValidate>
      <Typography variant="h2" component="h2" sx={{ mb: 2 }}>
        Record a decision
      </Typography>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 5 }}>
          {/*
            `Controller`, not `register`: MUI's `select` TextField renders a
            `Select`, whose ref does not point at anything RHF can read a value
            from. Same reason as the two selects in `ClaimIntakeWizard`.
          */}
          <Controller
            name="policyId"
            control={control}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                select
                fullWidth
                size="small"
                label="Policy"
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
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Controller
            name="outcome"
            control={control}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                select
                fullWidth
                size="small"
                label="Decision"
                error={Boolean(fieldState.error)}
                helperText={fieldState.error?.message}
              >
                {DECISION_OUTCOMES.map((outcome) => (
                  <MenuItem key={outcome} value={outcome}>
                    {DECISION_LABEL[outcome]}
                  </MenuItem>
                ))}
              </TextField>
            )}
          />
        </Grid>

        <Grid size={{ xs: 12, md: 3 }}>
          {/*
            `register`, not `Controller`: a native number input has a ref RHF
            can read. `valueAsNumber` is what stops the schema receiving the
            string "12" and failing every numeric rule.
          */}
          <TextField
            {...register('loadingPct', { valueAsNumber: true })}
            type="number"
            fullWidth
            size="small"
            label="Rate loading (%)"
            inputProps={{ min: 0, max: maxLoadingPct, step: 1 }}
            error={Boolean(errors.loadingPct)}
            helperText={errors.loadingPct?.message ?? `Your authority: ${maxLoadingPct}%`}
          />
        </Grid>

        <Grid size={12}>
          <TextField
            {...register('note')}
            fullWidth
            multiline
            minRows={2}
            size="small"
            label="Underwriting note"
            error={Boolean(errors.note)}
            helperText={errors.note?.message ?? 'Recorded against the policy for audit.'}
          />
        </Grid>

        {serverError ? (
          <Grid size={12}>
            <Alert severity="error">{serverError}</Alert>
          </Grid>
        ) : null}

        <Grid size={12}>
          <Button
            type="submit"
            variant="contained"
            // `!isDirty` keeps the button dead on an untouched form, whose only
            // possible outcome is a request that fails; `isSubmitting` is what
            // stops a double-click filing the decision twice.
            disabled={!isDirty || isSubmitting}
          >
            {isSubmitting ? 'Recording…' : 'Record decision'}
          </Button>
          {/*
            `isValid` is surfaced as text rather than as a disabled button, for
            the same reason the wizard's Continue stays clickable: a control
            that goes dead without saying why leaves the underwriter hunting
            for the field that is wrong.
          */}
          {isDirty && !isValid ? (
            <Typography component="span" variant="body2" sx={{ ml: 2, color: 'text.secondary' }}>
              Some fields still need attention.
            </Typography>
          ) : null}
        </Grid>
      </Grid>
    </Box>
  );
}
