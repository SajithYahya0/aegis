import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import {
  Card, LinearProgress, Link, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TableSortLabel, Typography,
} from '@mui/material';
import { fetchPolicies } from '../shared/http/client';
import { useDebounce, useLocalStorage } from '../shared/hooks';
import type { Policy, PolicyStatus, PolicyType } from '../shared/domain';
import { PolicyFilterBar, PolicyRow } from './PolicyBook';

const SEARCH_DEBOUNCE_MS = 300;
const MAX_RECENT = 5;

type SortKey = 'sumInsured' | 'annualPremium' | 'endDate';

const SORTABLE: readonly (readonly [SortKey, string])[] = [
  ['sumInsured', 'Sum insured'],
  ['annualPremium', 'Premium'],
  ['endDate', 'Expires'],
];

interface RecentPolicy {
  id: string;
  customerName: string;
}

export default function PoliciesPage(): ReactElement {
  const [searchParams, setSearchParams] = useSearchParams();
  const status = (searchParams.get('status') ?? '') as PolicyStatus | '';
  const type = (searchParams.get('type') ?? '') as PolicyType | '';
  const expiring = searchParams.get('expiring') === '1';
  const sortKey = (searchParams.get('sort') ?? 'sumInsured') as SortKey;

  const [query, setQuery] = useState(searchParams.get('q') ?? '');
  const debouncedQuery = useDebounce(query, SEARCH_DEBOUNCE_MS);
  const [rows, setRows] = useState<readonly Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [recent, setRecent] = useLocalStorage<RecentPolicy[]>('aegis.recent-policies', []);

  const setParam = useCallback(
    (key: string, value: string | null): void => {
      setSearchParams((previous) => {
        const next = new URLSearchParams(previous);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      }, { replace: true });
    },
    [setSearchParams],
  );

  useEffect(() => {
    if ((searchParams.get('q') ?? '') === debouncedQuery) return;
    setParam('q', debouncedQuery || null);
  }, [debouncedQuery, searchParams, setParam]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    fetchPolicies({ q: debouncedQuery, status, type, expiring }, controller.signal)
      .then((policies) => {
        setRows(policies);
        setLoading(false);
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [debouncedQuery, status, type, expiring]);

  function compare(a: Policy, b: Policy): number {
    if (sortKey === 'endDate') {
      return a.endDate.localeCompare(b.endDate);
    }
    return b[sortKey] - a[sortKey];
  }

  const sorted = [...rows].sort(compare);

  const handleSelect = useCallback(
    (policy: Policy) => {
      const entry = { id: policy.id, customerName: policy.customerName };
      setRecent((previous) => {
        const withoutThis = previous.filter((item) => item.id !== policy.id);
        return [entry, ...withoutThis].slice(0, MAX_RECENT);
      });
    },
    [setRecent],
  );

  return (
    <>
      <Typography variant="h1">Policies</Typography>
      <PolicyFilterBar
        query={query}
        status={status}
        type={type}
        expiring={expiring}
        onQueryChange={setQuery}
        onParamChange={setParam}
      />
      {recent.length > 0 ? (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Recently viewed:{' '}
          {recent.map((item) => (
            <Link key={item.id} component={RouterLink} to={`/policies/${item.id}`} sx={{ mr: 1.5 }}>
              {item.id} · {item.customerName}
            </Link>
          ))}
        </Typography>
      ) : null}
      <Card>
        {loading ? <LinearProgress aria-label="Loading policies" /> : null}
        <TableContainer>
          <Table size="small" aria-label="Policy book">
            <TableHead>
              <TableRow>
                <TableCell>Policy</TableCell>
                <TableCell>Customer</TableCell>
                <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>Type</TableCell>
                <TableCell>Status</TableCell>
                {SORTABLE.map(([key, label]) => (
                  <TableCell key={key} align="right">
                    <TableSortLabel
                      active={sortKey === key}
                      direction="desc"
                      onClick={() => setParam('sort', key)}
                    >
                      {label}
                    </TableSortLabel>
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {sorted.map((policy) => (
                <PolicyRow key={policy.id} policy={policy} onSelect={handleSelect} />
              ))}
              {!loading && sorted.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7}>No policies match these filters.</TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>
    </>
  );
}
