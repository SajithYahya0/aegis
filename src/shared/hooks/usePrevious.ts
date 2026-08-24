/**
 * WHY THIS EXISTS:
 *   Remembers the value a component held on its *previous* render, using a
 *   `ref` rather than `state` because recording history is not itself
 *   something the screen needs to react to — only the comparison between
 *   "current" and "previous" is ever rendered, by the caller.
 *
 * CONCEPTS: W2-D2-03
 *
 * WITHOUT THIS:
 *   The obvious-looking alternative — `const [prev, setPrev] = useState(value);
 *   useEffect(() => setPrev(value), [value])` — renders the *new* value
 *   alongside a `prev` that has not caught up yet (the effect that would
 *   update it has not run), then immediately re-renders once it has. A
 *   premium delta indicator built that way flashes "was ₹0" (or the value
 *   two changes ago) for one frame on every change, because `setPrev` inside
 *   an effect is itself a state update that schedules another render rather
 *   than being available in the render that needs it. Writing to a ref
 *   during render has no such lag: by the time this render reads
 *   `ref.current`, it still holds what was written last render, and this
 *   render's write only takes effect for the *next* one.
 */

import { useRef } from 'react';

export function usePrevious<T>(value: T): T | undefined {
  const currentRef = useRef(value);
  const previousRef = useRef<T | undefined>(undefined);

  if (currentRef.current !== value) {
    previousRef.current = currentRef.current;
    currentRef.current = value;
  }

  return previousRef.current;
}
