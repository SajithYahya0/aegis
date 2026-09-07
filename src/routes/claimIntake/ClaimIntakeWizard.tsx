/**
 * WHY THIS EXISTS:
 *   The claim intake wizard, rebuilt on `react-hook-form` + `zodResolver` over
 *   `claimSchema.ts`. Three steps, per-step validation through
 *   `trigger(fieldNames)`, and a submit that dispatches `submitClaimThunk` —
 *   which POSTs through the axios client and records the result in the store.
 *
 *   It is still the app's component-level code-split boundary: everything in
 *   this module lands in its own chunk that is not requested until the agent
 *   opens the intake dialog on `/claims/new`. It is still the *default* export
 *   for the same reason — `React.lazy` resolves `module.default` and nothing
 *   else, so a named export here fails at run time rather than at compile time.
 *
 *   WHAT `react-hook-form` BOUGHT HERE THAT THE CONTROLLED VERSION DID NOT.
 *   This file is the direct comparison to `src/routes/QuoteWizardPage.tsx`,
 *   which stays controlled + `useReducer` on purpose (see the Week 4 boundary
 *   section in `CLAUDE.md`). Both are multi-step wizards over a draft. Four
 *   concrete differences, in the order a reviewer will hit them:
 *
 *   1. TWELVE `useState` CALLS BECAME ZERO. The previous version of this file
 *      held one `useState` per field plus a `stepError` slot — twelve in all —
 *      and every keystroke in any field re-rendered the entire wizard,
 *      including the other ten inputs and the searchable policy index. RHF
 *      keeps field values in a ref-backed store and subscribes only what asks
 *      to be subscribed, so typing in "What happened" now re-renders the
 *      registered input and nothing else. `QuoteWizardPage` shows the cost of
 *      the other choice honestly: every step re-renders on every keystroke,
 *      which is fine there because it *wants* the live premium recalculated.
 *      That is the actual trade — controlled state is for when every render
 *      needs the value, and this wizard's renders do not.
 *
 *   2. VALIDATION MOVED OUT OF THE COMPONENT. `goNext()` used to be nine
 *      sequential `if` blocks writing one string into one error slot, so an
 *      agent with three blank fields was told about one of them per round
 *      trip. The rules now live in `claimSchema.ts`, are enforced by the
 *      resolver, and land per-field — all of them at once — which is what
 *      makes the `*` markers on the labels honest rather than decorative.
 *      They are also testable without mounting anything; see
 *      `claimSchema.test.ts`.
 *
 *   3. ONE DECLARATION OF THE DRAFT'S TYPE. `ClaimIntakeDraft` was a
 *      hand-written interface sitting beside the validation it was supposed to
 *      describe, and it had already drifted: it typed `amount: number` while
 *      the input produced a string, bridged by a `Number(amount)` at the call
 *      site. `ClaimDraftValues` is `z.infer` of the schema, so there is
 *      nothing to drift from.
 *
 *   4. THE SUBMIT PATH LOST ITS PRIVATE COPY OF THE OUTCOME. It used to be a
 *      `useActionState` returning `{ error }` into a local slot, so the claim
 *      that came back existed only long enough to build a toast. It now goes
 *      through `submitClaimThunk`, so the filed claim is in the store and
 *      `ClaimIntakePage` can list what this session actually filed.
 *
 *   WHAT WAS GIVEN UP, STATED RATHER THAN GLOSSED: `useActionState` (C-06) and
 *   `useFormStatus` (C-07) were this file's before. Both are still in the app
 *   on `PolicyClaimsTab`'s quick-claim form, which is the surface that used
 *   them the more interesting way anyway — validating out of `FormData` with
 *   real per-field errors, rather than validating ahead and returning one
 *   error slot. Their matrix rows are repointed at that file rather than left
 *   claiming this one. `isSubmitting` from `formState` is what disables the
 *   button now, and unlike `useFormStatus` it does not require the button to
 *   be a descendant of the `<form>` — which is what let the dialog's actions
 *   move into `DialogActions`, outside the form element, where MUI wants them.
 *
 * CONCEPTS: W4-D5-01, W4-D5-02, W4-D5-03, W4-D1-02, W4-D1-03, W4-D2-05, W3-D3-02, W4-D4-01
 *
 * WITHOUT THIS:
 *   Route-level splitting alone stops one route short. `/claims/new` is a page
 *   whose visible content is a paragraph and one button; the wizard is the
 *   heavy part — the step machine, the schema, the resolver, `react-hook-form`
 *   itself, the searchable index over all 140 policies — and most visits to
 *   that route never open it. Bundled with the route, that weight is
 *   downloaded and parsed by every visitor including the ones who read the
 *   page and leave. Splitting at the *dialog* moves the cost to the click that
 *   needs it, and the deferral is bigger now than it was before this pass
 *   because `react-hook-form` and `zod` ride in this chunk.
 *
 *   That split only works because MUI's `Dialog` renders nothing while closed.
 *   React does not load a lazy component because its element was *created* —
 *   `ClaimIntakePage` constructs the element on every render — it loads it
 *   when the element is *rendered*. A dialog implemented as `keepMounted` or
 *   as `<div hidden>` would render the lazy child immediately and download
 *   this chunk on page load, defeating the arrangement while looking identical
 *   on screen. `src/App.test.tsx` asserts the closed case.
 *
 *   NO `mode: 'onBlur'` — the default `onSubmit` mode instead: nothing is
 *   validated until the step's Continue button is pressed, so a mistyped
 *   amount is reported at the moment the agent has stopped thinking about the
 *   amount. `onChange` mode is the other extreme and is worse here: it marks a
 *   half-typed description invalid on the second character, so the form spends
 *   most of its life telling a correct user they are wrong.
 *   `reValidateMode: 'onChange'` is what resolves that — strict on the way in,
 *   forgiving on the way out. A field that has already failed re-checks on
 *   every keystroke, so the error clears the instant it is fixed rather than
 *   waiting for another blur.
 *
 *   NO PER-STEP `trigger()` — one validation at submit instead: the Review
 *   step would render `undefined` where the policy and the amount should be,
 *   because it reads values the agent never had to supply. Step gating is not
 *   a nicety here; the review screen's contract is "everything below is
 *   filled in".
 *
 *   NO `Controller` ON THE TWO SELECTS: `register()` works by attaching a
 *   `ref` to a native form element. MUI's `Select` renders a `div` with a
 *   hidden input and `Autocomplete` renders a text field whose value is not
 *   the field's value, so a `ref` handed to either lands somewhere RHF cannot
 *   read — the field stays `undefined`, validation fails against a value the
 *   user can plainly see on screen, and nothing in the console says why.
 *   `Controller` subscribes the component to the field and drives it by
 *   `value`/`onChange` instead, which is the contract those components
 *   actually have.
 *
 *   NO `disabled={!isDirty || isSubmitting}` on Submit: without `isDirty` the
 *   button is live on a form nobody has touched, so the first click on an
 *   untouched wizard fires a request that can only fail; without
 *   `isSubmitting` a double-click files the claim twice, and the second one is
 *   a duplicate claim in the book with no way to tell which is real.
 *
 * A NOTE ON THE DATE CONTROL — read this before asking why it is not
 * `@mui/x-date-pickers`:
 *   `CLAUDE.md` pins the dependency list and says "nothing else without
 *   asking", and `@mui/x-date-pickers` (plus its `date-fns` adapter and
 *   `LocalizationProvider`) is not on it. The date control is therefore a MUI
 *   `TextField type="date"` — the same component the rest of this form uses,
 *   in the picker role. It is wrapped in a `Controller` rather than
 *   `register`ed, and the honest reason is not the one that applies to the
 *   selects above: a native date input *does* expose a ref, so `register`
 *   would work here. It is on `Controller` so that swapping in a real
 *   `DatePicker` the day that dependency is approved is a change to one
 *   element and not a rewrite of how the field is wired. That is a deliberate
 *   trade of a little machinery for a small blast radius, and it is written
 *   down rather than left for a reviewer to find.
 */

import { useMemo, useState, type ReactElement } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Alert from '@mui/material/Alert';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import Grid from '@mui/material/Grid2';
import MenuItem from '@mui/material/MenuItem';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import Stepper from '@mui/material/Stepper';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { customersById, policies, policiesById } from '../../shared/data';
import { formatCurrency } from '../../shared/format';
import { useAppDispatch } from '../../shared/store';
import { submitClaimThunk } from '../../shared/store/claimsSlice';
import { StatusChip } from '../../shared/theme/StatusChip';
import type { Claim } from '../../shared/types';
import {
  CLAIM_TYPES,
  CLAIM_TYPE_LABEL,
  EMPTY_CLAIM_DRAFT,
  claimSchema,
  todayIso,
  type ClaimDraftValues,
} from './claimSchema';

const STEPS = ['Policy', 'Incident', 'Review'] as const;
type WizardStep = (typeof STEPS)[number];

/**
 * Which fields each step is answerable for.
 *
 * This map is what `trigger()` is given, and it is a constant rather than an
 * inline array at the call site so that the Review step's `[]` is *stated*.
 * An empty list means "nothing new to check here" — everything the review
 * screen shows was validated by the step that collected it — and writing it
 * down is what stops someone from later reading the absence of a `trigger`
 * call on Review as an oversight.
 *
 * `readonly (keyof ClaimDraftValues)[]` rather than `string[]`: renaming a
 * schema field then breaks the build here instead of silently producing a step
 * gate that validates nothing and always passes.
 */
const STEP_FIELDS: Record<WizardStep, readonly (keyof ClaimDraftValues)[]> = {
  Policy: ['policyId'],
  Incident: [
    'type',
    'amount',
    'incidentDate',
    'incidentLocation',
    'description',
    'claimantPhone',
    'claimantEmail',
  ],
  Review: [],
};

export interface ClaimIntakeWizardProps {
  /** Called once the claim is in the store — the page closes the dialog. */
  onSubmitted: (claim: Claim) => void;
  onCancel: () => void;
}

export default function ClaimIntakeWizard({
  onSubmitted,
  onCancel,
}: ClaimIntakeWizardProps): ReactElement {
  const dispatch = useAppDispatch();
  const [step, setStep] = useState<WizardStep>('Policy');
  const stepIndex = STEPS.indexOf(step);

  const {
    register,
    control,
    handleSubmit,
    trigger,
    watch,
    setError,
    formState: { errors, isSubmitting, isDirty, isValid },
  } = useForm<ClaimDraftValues>({
    resolver: zodResolver(claimSchema),
    // Strict on the way in, forgiving on the way out — see the header.
    mode: 'onBlur',
    reValidateMode: 'onChange',
    defaultValues: EMPTY_CLAIM_DRAFT,
  });

  /*
   * `watch` on two fields rather than on the whole form: an argument-less
   * `watch()` subscribes this component to every keystroke in every field,
   * which would undo the main thing RHF is here for. These two are genuinely
   * needed during render — the policy drives the review screen and the
   * amount's helper text, and the amount is shown formatted on Review.
   */
  const policyId = watch('policyId');
  const amount = watch('amount');
  const selected = policyId ? policiesById.get(policyId) : undefined;

  /*
   * The searchable index, and part of what makes this chunk worth splitting.
   * `Autocomplete` filters the list it is given, so the whole book goes in and
   * the option label is built once per policy instead of once per keystroke.
   */
  const options = useMemo(
    () =>
      policies.map((policy) => ({
        id: policy.id,
        label: `${policy.id} · ${customersById.get(policy.customerId)?.name ?? '—'}`,
        sumInsured: policy.sumInsured,
      })),
    [],
  );

  /**
   * The step gate. `trigger` returns a promise for "did these fields pass",
   * and awaiting it is what makes this an `async` handler rather than a
   * one-liner — the resolver runs the whole schema, so this cannot be answered
   * synchronously.
   */
  async function goNext(): Promise<void> {
    const ok = await trigger(STEP_FIELDS[step] as (keyof ClaimDraftValues)[]);
    if (!ok) return;
    if (step === 'Policy') setStep('Incident');
    else if (step === 'Incident') setStep('Review');
  }

  function goBack(): void {
    if (step === 'Review') setStep('Incident');
    else if (step === 'Incident') setStep('Policy');
  }

  /**
   * Runs only after the resolver has passed the whole schema, so `values` is
   * `ClaimDraftValues` and not "whatever was in the inputs".
   *
   * The `try`/`catch` is not defensive padding: `handleSubmit` does not swallow
   * a rejection from this callback, and `.unwrap()` re-throws the thunk's
   * `rejectWithValue` payload on purpose. Without the catch, a 502 from the
   * `claim-submit-failure` lab toggle becomes an unhandled rejection in the
   * console and nothing at all on screen. `root.submit` is used rather than a
   * field path because the failure belongs to the request, not to any one
   * input — and RHF clears `root` errors on the next submit automatically,
   * which a `useState` error slot would not.
   */
  const onValid = handleSubmit(async (values: ClaimDraftValues) => {
    try {
      const claim = await dispatch(
        submitClaimThunk({
          policyId: values.policyId,
          type: values.type,
          amount: values.amount,
          description: values.description,
        }),
      ).unwrap();
      onSubmitted(claim);
    } catch (thrown) {
      setError('root.submit', {
        message: typeof thrown === 'string' ? thrown : 'Could not submit the claim.',
      });
    }
  });

  const submitError = errors.root?.submit?.message;

  return (
    <Box component="form" onSubmit={onValid} noValidate>
      <DialogTitle id="claim-intake-title">New claim</DialogTitle>

      <DialogContent dividers>
        <Stepper activeStep={stepIndex} sx={{ mb: 3 }}>
          {STEPS.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {step === 'Policy' ? (
          /*
           * `Controller`, not `register`: `Autocomplete`'s ref points at its
           * text input, whose value is the *search string*, not the selected
           * option's id. See the header.
           */
          <Controller
            name="policyId"
            control={control}
            render={({ field, fieldState }) => (
              <Autocomplete
                options={options}
                autoHighlight
                value={options.find((option) => option.id === field.value) ?? null}
                onChange={(_event, option) => field.onChange(option?.id ?? '')}
                onBlur={field.onBlur}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    inputRef={field.ref}
                    label="Policy *"
                    placeholder="Policy number or customer name"
                    error={Boolean(fieldState.error)}
                    helperText={
                      fieldState.error?.message ??
                      (selected
                        ? `Sum insured ${formatCurrency(selected.sumInsured)}`
                        : 'Search the whole book by policy number or customer.')
                    }
                  />
                )}
              />
            )}
          />
        ) : null}

        {step === 'Incident' ? (
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              {/*
                `Controller` again — MUI's `select` TextField renders a `Select`
                underneath, so the same ref problem applies.
              */}
              <Controller
                name="type"
                control={control}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    select
                    fullWidth
                    label="Claim type"
                    error={Boolean(fieldState.error)}
                    helperText={fieldState.error?.message}
                  >
                    {CLAIM_TYPES.map((claimType) => (
                      <MenuItem key={claimType} value={claimType}>
                        {CLAIM_TYPE_LABEL[claimType]}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              {/*
                `register`, not `Controller`: a native number input has a ref
                RHF can read. `valueAsNumber` is what stops the schema from
                receiving the string "40000" and failing every numeric rule —
                and an empty box becomes `NaN`, which `claimSchema` answers
                with "Enter the amount claimed, in rupees."
              */}
              <TextField
                {...register('amount', { valueAsNumber: true })}
                type="number"
                fullWidth
                label="Amount claimed (₹) *"
                inputProps={{ min: 0, step: 100 }}
                error={Boolean(errors.amount)}
                helperText={
                  errors.amount?.message ??
                  (selected ? `Cannot exceed ${formatCurrency(selected.sumInsured)}` : ' ')
                }
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <Controller
                name="incidentDate"
                control={control}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    type="date"
                    fullWidth
                    label="Date of incident *"
                    // Without `shrink`, MUI floats the label over the date
                    // input's own `dd/mm/yyyy` placeholder, which the browser
                    // renders whether or not there is a value.
                    InputLabelProps={{ shrink: true }}
                    // The native clamp. It is the affordance, not the rule —
                    // `claimSchema` re-checks it, because a typed date and a
                    // pasted one both bypass the picker's own limit.
                    inputProps={{ max: todayIso() }}
                    error={Boolean(fieldState.error)}
                    helperText={fieldState.error?.message}
                  />
                )}
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                {...register('claimantPhone')}
                fullWidth
                label="Claimant phone *"
                error={Boolean(errors.claimantPhone)}
                helperText={errors.claimantPhone?.message}
              />
            </Grid>

            <Grid size={12}>
              <TextField
                {...register('incidentLocation')}
                fullWidth
                label="Incident location *"
                placeholder="Street, city — where the loss occurred"
                error={Boolean(errors.incidentLocation)}
                helperText={errors.incidentLocation?.message}
              />
            </Grid>

            <Grid size={12}>
              <TextField
                {...register('description')}
                fullWidth
                multiline
                minRows={3}
                label="What happened *"
                error={Boolean(errors.description)}
                helperText={errors.description?.message ?? 'At least 20 characters.'}
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                {...register('claimantEmail')}
                fullWidth
                label="Claimant email"
                error={Boolean(errors.claimantEmail)}
                helperText={errors.claimantEmail?.message ?? 'Optional.'}
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                {...register('policeReportNumber')}
                fullWidth
                label="Police report / FIR number"
                helperText="If one was filed."
              />
            </Grid>

            <Grid size={12}>
              {/*
                A checkbox's value is `checked`, not `value`, so it is
                `Controller`-driven for the third distinct reason on this form:
                not a missing ref, but the wrong property on the one it has.
              */}
              <Controller
                name="thirdPartyInvolved"
                control={control}
                render={({ field }) => (
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={field.value}
                        onChange={(event) => field.onChange(event.target.checked)}
                        onBlur={field.onBlur}
                      />
                    }
                    label="Third party involved"
                  />
                )}
              />
            </Grid>
          </Grid>
        ) : null}

        {step === 'Review' && selected ? (
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Typography variant="h2" component="p">
                {formatCurrency(amount)}
              </Typography>
              <StatusChip status={selected.status} />
            </Box>
            <ReviewRow label="Policy" value={selected.id} />
            <ReviewRow
              label="Customer"
              value={customersById.get(selected.customerId)?.name ?? '—'}
            />
            <ReviewRow label="Sum insured" value={formatCurrency(selected.sumInsured)} />
            <ReviewRow label="Claim type" value={CLAIM_TYPE_LABEL[watch('type')]} />
            <ReviewRow label="Incident date" value={watch('incidentDate')} />
            <ReviewRow label="Incident location" value={watch('incidentLocation')} />
            <ReviewRow label="Description" value={watch('description')} />
            <ReviewRow label="Claimant phone" value={watch('claimantPhone')} />
            {/* Em dash rather than an empty cell: "not supplied" and "the row
                failed to render" should not look the same on a review screen. */}
            <ReviewRow label="Claimant email" value={watch('claimantEmail') || '—'} />
            <ReviewRow label="Police report / FIR" value={watch('policeReportNumber') || '—'} />
            <ReviewRow
              label="Third party involved"
              value={watch('thirdPartyInvolved') ? 'Yes' : 'No'}
            />
          </Box>
        ) : null}

        {submitError ? (
          <Alert severity="error" sx={{ mt: 2 }}>
            {submitError}
          </Alert>
        ) : null}
      </DialogContent>

      {/*
        `DialogActions` sits outside `<DialogContent>` but inside the `<form>`
        element this component roots, so `type="submit"` reaches the right
        handler. That is only possible because the pending flag now comes from
        `formState.isSubmitting` rather than `useFormStatus`, which would have
        required these buttons to be descendants of a `<form>` they render
        beside. See the header.
      */}
      <DialogActions>
        <Button type="button" onClick={step === 'Policy' ? onCancel : goBack} disabled={isSubmitting}>
          {step === 'Policy' ? 'Cancel' : 'Back'}
        </Button>
        {step === 'Review' ? (
          <Button type="submit" variant="contained" disabled={!isDirty || isSubmitting}>
            {isSubmitting ? 'Submitting…' : 'Submit claim'}
          </Button>
        ) : (
          /*
           * `type="button"`: Continue must never submit the enclosing form. It
           * is a plain click handler that awaits `trigger()`.
           *
           * `isValid` is read here and nowhere else. It is *not* used to
           * disable this button — a step gate that cannot be pressed gives the
           * agent no way to find out what is wrong — it drives the variant, so
           * a form that would pass looks different from one that would not
           * without the button going dead.
           */
          <Button type="button" onClick={goNext} variant={isValid ? 'contained' : 'outlined'}>
            Continue
          </Button>
        )}
      </DialogActions>
    </Box>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: '160px 1fr' },
        gap: 1,
        py: 0.75,
        borderBottom: 1,
        borderColor: 'divider',
      }}
    >
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        {label}
      </Typography>
      <Typography variant="body2">{value}</Typography>
    </Box>
  );
}
