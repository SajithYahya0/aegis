import type { ReactElement } from 'react';

export interface FilterStatusProps {
  resultCount: number;
  totalCount: number;
  isStale: boolean;
}

export function FilterStatus({ resultCount, totalCount, isStale }: FilterStatusProps): ReactElement {
  console.log('[render] FilterStatus');

  return (
    <p>
      {isStale ? (
        <>Updating…</>
      ) : (
        <>
          {resultCount} of {totalCount} policies
        </>
      )}
    </p>
  );
}
