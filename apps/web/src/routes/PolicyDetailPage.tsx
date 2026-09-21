import { useEffect, useState, type ReactElement } from 'react';
import { NavLink, Outlet, useLocation, useOutletContext, useParams } from 'react-router-dom';
import {
  Card, CardContent, Chip, LinearProgress, Stack, Tab, Tabs, Typography,
} from '@mui/material';
import { fetchPolicyDetail } from '../shared/http/client';
import {
  POLICY_STATUS_COLOR, POLICY_STATUS_LABEL, POLICY_TYPE_LABEL, daysUntil,
  formatCurrency, formatDate,
} from '../shared/domain';
import type { PolicyDetail } from '../shared/domain';

export function usePolicyDetail(): PolicyDetail {
  return useOutletContext<PolicyDetail>();
}

function Field({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <Stack>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        {label}
      </Typography>
      <Typography variant="body1">{value}</Typography>
    </Stack>
  );
}

export default function PolicyDetailPage(): ReactElement {
  const { id = '' } = useParams<{ id: string }>();
  const { pathname } = useLocation();
  const [detail, setDetail] = useState<PolicyDetail | null>(null);
  const [failure, setFailure] = useState<Error | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetchPolicyDetail(id, controller.signal)
      .then(setDetail)
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setFailure(reason instanceof Error ? reason : new Error(`Policy ${id} is unavailable.`));
      });
    return () => controller.abort();
  }, [id]);

  if (failure) throw failure;
  if (!detail) return <LinearProgress aria-label="Loading policy" />;

  const { policy } = detail;
  const remaining = daysUntil(policy.endDate);

  return (
    <>
      <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
        <Typography variant="h1">{policy.id}</Typography>
        <Chip
          size="small"
          variant="outlined"
          color={POLICY_STATUS_COLOR[policy.status]}
          label={POLICY_STATUS_LABEL[policy.status]}
        />
        <Chip
          size="small"
          color={remaining >= 0 && remaining <= 30 ? 'warning' : 'default'}
          label={remaining < 0 ? 'Renewal overdue' : `Renews in ${remaining} days`}
        />
      </Stack>
      <Card>
        <CardContent>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={4}
            useFlexGap
            sx={{ flexWrap: 'wrap' }}
          >
            <Field label="Customer" value={policy.customerName} />
            <Field label="Branch" value={policy.city} />
            <Field label="Product" value={POLICY_TYPE_LABEL[policy.type]} />
            <Field label="Sum insured" value={formatCurrency(policy.sumInsured)} />
            <Field label="Annual premium" value={formatCurrency(policy.annualPremium)} />
            <Field label="Cover from" value={formatDate(policy.startDate)} />
            <Field label="Cover to" value={formatDate(policy.endDate)} />
          </Stack>
        </CardContent>
      </Card>
      <Tabs value={pathname.endsWith('/claims') ? 1 : 0}>
        <Tab component={NavLink} to="." end label="Coverage" />
        <Tab component={NavLink} to="claims" label={`Claims (${detail.claims.length})`} />
      </Tabs>
      <Outlet context={detail} />
    </>
  );
}
