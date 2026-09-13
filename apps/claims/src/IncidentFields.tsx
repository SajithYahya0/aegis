import { useImperativeHandle, useRef, type ReactElement, type Ref } from 'react';
import { Controller, useFormState, type Control } from 'react-hook-form';
import { MenuItem, Stack, TextField } from '@mui/material';
import {
  CLAIM_TYPES,
  CLAIM_TYPE_LABEL,
  formatRupees,
  todayIso,
  type ClaimFormValues,
  type PolicyOption,
} from './claimSchema';

export const INCIDENT_FIELDS = [
  'policyId', 'type', 'amount', 'incidentDate', 'claimantPhone', 'description',
] as const;

type IncidentField = (typeof INCIDENT_FIELDS)[number];

interface PlainField {
  name: IncidentField;
  label: string;
  type: string;
  multiline?: boolean;
}

const PLAIN_FIELDS: readonly PlainField[] = [
  { name: 'amount', label: 'Amount claimed (₹)', type: 'number' },
  { name: 'incidentDate', label: 'Date of incident', type: 'date' },
  { name: 'claimantPhone', label: 'Claimant phone', type: 'tel' },
  { name: 'description', label: 'What happened', type: 'text', multiline: true },
];

export interface IncidentFieldsHandle {
  focusFirstInvalid: () => void;
}

export interface IncidentFieldsProps {
  ref: Ref<IncidentFieldsHandle>;
  control: Control<ClaimFormValues>;
  policies: readonly PolicyOption[];
}

export function IncidentFields({ ref, control, policies }: IncidentFieldsProps): ReactElement {
  const { errors } = useFormState({ control });
  const inputs = useRef<Partial<Record<IncidentField, HTMLElement | null>>>({});

  useImperativeHandle(
    ref,
    () => ({
      focusFirstInvalid: () => {
        const invalid = INCIDENT_FIELDS.find((name) => errors[name]);
        if (invalid) inputs.current[invalid]?.focus();
      },
    }),
    [errors],
  );

  return (
    <Stack spacing={2}>
      <Controller
        name="policyId"
        control={control}
        render={({ field, fieldState }) => (
          <TextField
            {...field}
            select
            label="Policy"
            inputRef={(element: HTMLElement | null) => { inputs.current.policyId = element; }}
            error={Boolean(fieldState.error)}
            helperText={fieldState.error?.message ?? 'The policy this loss is claimed against.'}
          >
            {policies.map((policy) => (
              <MenuItem key={policy.id} value={policy.id}>
                {policy.id} · {policy.customerName} · {formatRupees(policy.sumInsured)}
              </MenuItem>
            ))}
          </TextField>
        )}
      />
      <Controller
        name="type"
        control={control}
        render={({ field }) => (
          <TextField
            {...field}
            select
            label="Claim type"
            inputRef={(element: HTMLElement | null) => { inputs.current.type = element; }}
          >
            {CLAIM_TYPES.map((value) => (
              <MenuItem key={value} value={value}>{CLAIM_TYPE_LABEL[value]}</MenuItem>
            ))}
          </TextField>
        )}
      />
      {PLAIN_FIELDS.map((spec) => (
        <Controller
          key={spec.name}
          name={spec.name}
          control={control}
          render={({ field, fieldState }) => (
            <TextField
              {...field}
              type={spec.type}
              label={spec.label}
              multiline={spec.multiline}
              minRows={spec.multiline ? 3 : undefined}
              value={field.value ?? ''}
              onChange={(event) =>
                field.onChange(
                  spec.type === 'number' && event.target.value !== ''
                    ? Number(event.target.value)
                    : spec.type === 'number'
                      ? undefined
                      : event.target.value,
                )
              }
              inputRef={(element: HTMLElement | null) => { inputs.current[spec.name] = element; }}
              slotProps={{
                inputLabel: spec.type === 'date' ? { shrink: true } : undefined,
                htmlInput: spec.type === 'date' ? { max: todayIso() } : undefined,
              }}
              error={Boolean(fieldState.error)}
              helperText={fieldState.error?.message}
            />
          )}
        />
      ))}
    </Stack>
  );
}
