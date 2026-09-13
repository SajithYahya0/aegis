import type { ReactElement } from 'react';
import {
  Button, Checkbox, FormControlLabel, MenuItem, Stack, TextField, Typography,
} from '@mui/material';
import { POLICY_TYPES, POLICY_TYPE_LABEL, formatCurrency } from '../shared/domain';
import { COVERAGE_TEMPLATES } from '../shared/rating';
import { useQuote, type InsuredParty, type QuoteDraft } from './QuoteContext';

const RELATIONSHIPS = ['self', 'spouse', 'child', 'parent'] as const;
const TERM_OPTIONS = [6, 12, 24, 36];

interface PartyProps {
  party: InsuredParty;
  index: number;
}

function InsuredPartyFields({ party, index }: PartyProps): ReactElement {
  const { dispatch } = useQuote();
  const patch = (changes: Partial<Omit<InsuredParty, 'key'>>): void => {
    dispatch({ type: 'updateInsured', key: party.key, patch: changes });
  };

  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
      <TextField
        label={`Insured ${index + 1} name`}
        required
        value={party.fullName}
        onChange={(event) => patch({ fullName: event.target.value })}
      />
      <TextField
        label="Date of birth"
        type="date"
        required
        value={party.dateOfBirth}
        slotProps={{ inputLabel: { shrink: true } }}
        onChange={(event) => patch({ dateOfBirth: event.target.value })}
      />
      <TextField
        select
        label="Relation"
        value={party.relationship}
        sx={{ minWidth: 120 }}
        onChange={(event) =>
          patch({ relationship: event.target.value as InsuredParty['relationship'] })
        }
      >
        {RELATIONSHIPS.map((value) => (
          <MenuItem key={value} value={value}>{value}</MenuItem>
        ))}
      </TextField>
      <Button onClick={() => dispatch({ type: 'removeInsured', key: party.key })}>Remove</Button>
    </Stack>
  );
}

export function ApplicantStep(): ReactElement {
  const { draft, dispatch } = useQuote();

  return (
    <>
      <TextField
        select
        label="Product"
        value={draft.type}
        onChange={(event) =>
          dispatch({ type: 'setType', policyType: event.target.value as QuoteDraft['type'] })
        }
      >
        {POLICY_TYPES.map((value) => (
          <MenuItem key={value} value={value}>{POLICY_TYPE_LABEL[value]}</MenuItem>
        ))}
      </TextField>
      <TextField
        label="City"
        required
        value={draft.city}
        onChange={(event) => dispatch({ type: 'setCity', city: event.target.value })}
      />
      {draft.insured.map((party, index) => (
        <InsuredPartyFields key={party.key} party={party} index={index} />
      ))}
      <Button onClick={() => dispatch({ type: 'addInsured' })} sx={{ alignSelf: 'flex-start' }}>
        Add insured party
      </Button>
    </>
  );
}

export function RiskStep(): ReactElement {
  const { draft, dispatch } = useQuote();
  const setNumber = (field: 'sumInsured' | 'termMonths' | 'priorClaims', raw: string): void => {
    dispatch({ type: 'setNumber', field, value: Number(raw) });
  };

  return (
    <>
      <TextField
        label="Sum insured"
        type="number"
        required
        value={draft.sumInsured}
        onChange={(event) => setNumber('sumInsured', event.target.value)}
      />
      <TextField
        select
        label="Term"
        value={draft.termMonths}
        onChange={(event) => setNumber('termMonths', event.target.value)}
      >
        {TERM_OPTIONS.map((months) => (
          <MenuItem key={months} value={months}>{months} months</MenuItem>
        ))}
      </TextField>
      <TextField
        label="Prior claims in the last 3 years"
        type="number"
        required
        value={draft.priorClaims}
        onChange={(event) => setNumber('priorClaims', event.target.value)}
      />
    </>
  );
}

export function CoverageStep(): ReactElement {
  const { draft, dispatch } = useQuote();
  const optional = COVERAGE_TEMPLATES[draft.type].filter((cover) => !cover.mandatory);

  return (
    <>
      {optional.map((cover) => (
        <FormControlLabel
          key={cover.code}
          label={cover.label}
          control={
            <Checkbox
              checked={draft.optionalCoverageCodes.includes(cover.code)}
              onChange={() => dispatch({ type: 'toggleCoverage', code: cover.code })}
            />
          }
        />
      ))}
    </>
  );
}

export function ReviewStep(): ReactElement {
  const { draft, dispatch } = useQuote();

  return (
    <>
      <Typography variant="body1">
        {POLICY_TYPE_LABEL[draft.type]} · {draft.city} ·{' '}
        {formatCurrency(draft.sumInsured)} over {draft.termMonths} months
      </Typography>
      <Typography variant="body1">
        {draft.insured.length} insured · {draft.priorClaims} prior claim(s) ·{' '}
        {draft.optionalCoverageCodes.length} optional cover(s)
      </Typography>
      <Button color="error" onClick={() => dispatch({ type: 'reset' })}>
        Start over
      </Button>
    </>
  );
}
