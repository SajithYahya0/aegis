/**
 * WHY THIS EXISTS:
 *   The public surface of the labs folder. `AppLayout` and `QuoteContext` both
 *   need one piece of this module each; this file is the single place that
 *   lists what is meant to be imported from outside `labs/`.
 *
 * CONCEPTS: (barrel file — no concept of its own)
 *
 * WITHOUT THIS:
 *   Consumers would reach into `labs/registry.ts` or `labs/LabPanel.tsx`
 *   directly, so a later rename or split of the internal files becomes a
 *   multi-file find-and-replace across `src/shared/` and `src/routes/`
 *   instead of a one-line change here.
 */

export { LabPanel } from './LabPanel';
export { isLabEnabled, setLabEnabled, subscribeLab, LAB_DEFECTS } from './registry';
export type { LabDefect, LabDefectId } from './registry';
export { useLabFlag } from './useLabFlag';
