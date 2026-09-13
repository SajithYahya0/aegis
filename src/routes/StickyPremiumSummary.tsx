import { useLayoutEffect, useRef, useState, type ReactElement } from 'react';
import { Box, Paper, Stack, Typography } from '@mui/material';
import { formatCurrency } from '../shared/domain';

export function StickyPremiumSummary({ premium }: { premium: number }): ReactElement {
  const barRef = useRef<HTMLDivElement>(null);
  const [barHeight, setBarHeight] = useState(0);
  const [shownPremium, setShownPremium] = useState(premium);
  const [previousPremium, setPreviousPremium] = useState<number | null>(null);

  if (shownPremium !== premium) {
    setPreviousPremium(shownPremium);
    setShownPremium(premium);
  }

  useLayoutEffect(() => {
    const measured = barRef.current?.getBoundingClientRect().height ?? 0;
    setBarHeight((current) => (current === measured ? current : measured));
  });

  const movement =
    previousPremium === null || previousPremium === premium
      ? null
      : { rose: premium > previousPremium, from: previousPremium };

  return (
    <>
      <Box sx={{ height: barHeight }} />
      <Paper
        ref={barRef}
        elevation={3}
        square
        sx={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 1200, px: 3, py: 1.5 }}
      >
        <Stack
          direction="row"
          spacing={2}
          sx={{ alignItems: 'baseline', justifyContent: 'flex-end', flexWrap: 'wrap' }}
        >
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Indicative annual premium
          </Typography>
          <Typography variant="h2">{formatCurrency(premium)}</Typography>
          {movement ? (
            <Typography
              variant="body2"
              sx={{ color: movement.rose ? 'error.main' : 'success.main' }}
            >
              {movement.rose ? '▲' : '▼'} was {formatCurrency(movement.from)}
            </Typography>
          ) : null}
        </Stack>
      </Paper>
    </>
  );
}
