import { useEffect, useState } from 'react';
import { isLabEnabled, subscribeLab, type LabDefectId } from './registry';

export function useLabFlag(id: LabDefectId): boolean {
  const [flag, setFlag] = useState(() => isLabEnabled(id));

  useEffect(() => {
    setFlag(isLabEnabled(id));
    return subscribeLab(() => setFlag(isLabEnabled(id)));
  }, [id]);

  return flag;
}
