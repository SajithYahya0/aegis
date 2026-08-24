# AEGIS — Hostile Q&A Drills

Self-testing material. Every question is collapsed: read the question, answer it
out loud, *then* open the answer. Opening first defeats the purpose.

These are not definition checks. Each section carries at least one question that
attacks the decision rather than the concept — *"you could have solved this
without X, so why is X here?"* — because that is the form the real question
takes. A reviewer who already knows what `useMemo` does is not asking what it
does.

Answers cite real files. Where the honest answer is "this one does not hold up",
it says so — a drill that rehearses a defence of something indefensible is worse
than no drill. Those answers are marked **⚠ WEAK SPOT** and are cross-referenced
in `docs/coverage-matrix.md`'s audit.

---

## 1. `memo` / `useMemo` / `useCallback`

<details>
<summary><b>1.1</b> — <code>PoliciesPage</code> memoises <code>rateBook</code> on <code>[policies, customers, claims]</code>. All three are module-level singletons from <code>src/shared/data</code> that never change for the lifetime of the app. A dependency array that can never fire is a constant with extra steps. Why is that <code>useMemo</code> not just a module-level <code>const</code>?</summary>

Because the two differ in *when* the work happens, not whether it repeats.

A module-level `const PREMIUMS = rateBook(...)` runs at import time — which,
now that `PoliciesPage` is a lazy chunk, means it runs while the Suspense
fallback is on screen and blocks the chunk from finishing evaluation. Every
visitor to `/policies` pays 25–40ms of rating before React gets the module,
including one who lands there and immediately navigates away.

Inside `useMemo`, it runs during the first render of the component that needs
it, and never again — same one-time cost, but attributable to the render and
interruptible by React's scheduler along with the rest of that render.

The honest concession: the *dependency array* is doing nothing. It could be
`[]` and behave identically. It is written out in full because listing the real
inputs is what makes the memo survive the data layer becoming mutable later —
the day `policies` comes from a fetch rather than a module, `[]` is a stale-data
bug and `[policies, customers, claims]` is already correct.

What the array is emphatically *not* is `[filtered]`. See 1.2.
</details>

<details>
<summary><b>1.2</b> — Rating the whole 140-policy book on every render sounds wasteful when the filter has narrowed it to four rows. Why not <code>rateBook(filtered, ...)</code>?</summary>

That version shipped and was wrong twice over — `PoliciesPage.tsx`'s header
records it as a bug found in the console, not a hypothetical.

1. **It falsifies the "expensive computation" claim.** Narrowing 140 policies
   to 4 makes `rateBook` *cheaper*. The console read `rateBook 4 policies in
   0.6ms`. Memoising a 0.6ms call is cargo cult; the row W3-D1-03 claims stops
   being demonstrable.

2. **It defeats `PolicyRow`'s memo for every row still on screen.** `rateBook`
   returns a fresh `Map` of fresh `PremiumBreakdown` objects every call — it
   never reuses an object for a policy it has already priced. `filtered`'s array
   identity changes on nearly every keystroke, so `premiums` recomputed nearly
   every keystroke, so every visible row received a *new* `premium` prop even
   though its own policy had not changed. `React.memo` correctly saw a changed
   prop and re-rendered.

The second one is the more useful lesson: the memo looked broken, but the defect
was upstream identity churn in a prop the row depends on. Rating the full book
once and looking premiums up by id means a row still in `filtered` gets back the
*same object*, so its comparison actually passes instead of only appearing to.
</details>

<details>
<summary><b>1.3</b> — <code>PremiumBadge</code> has a custom comparator that formats both amounts and compares the strings. Defend it.</summary>

**⚠ WEAK SPOT.** It does not hold up, and the repo's own measurement says so.

Two independent problems:

- **It can never run.** `PremiumBadge` is only rendered by `PolicyRow`, which is
  itself memoised and receives a referentially stable `premium` (see 1.2). A
  parent that bails out never renders its child, so the child's comparator is
  never reached. `docs/render-counts.md` concedes this: the comparator "doesn't
  diverge from `PolicyRow`'s default one in this run … there's no second,
  paisa-perturbed pricing pass for the comparator to catch."

- **If it ran, it would lose.** The comparator calls `formatCurrency` twice.
  `PremiumBadgeImpl` calls it once. A comparator that costs two `Intl` format
  calls to skip a render costing one is strictly more expensive than not
  memoising — which is precisely the argument `FilterStatus`'s header makes for
  W3-D1-06, applied here and reaching the opposite conclusion from the one this
  file draws.

The defensible version: drop the comparator and let the default shallow compare
on `amount` do the job, or — if formatted-equality really is the semantics
wanted — pass the pre-formatted string as the prop and let shallow compare
handle it for free. The scenario the comparator defends against (two `rateBook`
runs pricing the same policy a paisa apart) cannot occur while `rateBook` runs
exactly once per session.
</details>

<details>
<summary><b>1.4</b> — <code>FilterStatus</code> is deliberately un-memoised and its header brags about it. Is that a real decision or a rationalisation for not doing the work?</summary>

Real, and falsifiable. `resultCount` and `isStale` both derive from `rawQuery`,
which changes on every keystroke. Any render that could reach `FilterStatus` is
a render where its props are new. A `React.memo` there would run its comparison
once per keystroke, report "changed" every time, and re-render anyway: the cost
of the comparison plus the cost of the render it can never skip.

The falsification test is in `docs/render-counts.md`: `FilterStatus` logs 8
renders across the measured sequence while `PolicyRow` logs 0 for the keystrokes
that leave the set unchanged. If memoising `FilterStatus` moved that 8 at all,
the claim would be wrong. It cannot, because `isStale` genuinely flips on those
keystrokes — that is the component's entire job.

The contrast is the point: `PolicyRow`'s props stay identical between keystrokes
*because they come from the deferred value*. `FilterStatus`'s do not *because it
reads the urgent one*. Same page, same keystroke, opposite correct answers.
</details>

<details>
<summary><b>1.5</b> — <code>handleSelect</code> is wrapped in <code>useCallback</code> with deps <code>[setRecentIds]</code>. How do you know that dependency is stable, and what happens if you are wrong?</summary>

`useLocalStorage` returns the raw `useState` setter as its second element —
`return [value, setValue]`, not a wrapper. React guarantees a `useState` setter
is stable for the life of the component, so `[setRecentIds]` never fires and
`handleSelect` keeps one identity forever.

If it were wrong — if `useLocalStorage` returned, say, `(v) => { setValue(v);
log(v); }` — the deps would change every render, `handleSelect` would get a new
identity every render, and `PolicyRow`'s memo would fail on `onSelect` for all
140 rows on every keystroke. The symptom is identical to the `premiums` bug in
1.2: memo appears broken, cause is a churning prop identity. That is why
`PoliciesPage`'s header records that this specific dependency was "checked and
cleared" rather than assumed — it is the second-most-likely place for the same
class of bug to hide.
</details>

---

## 2. `useEffect` deps and cleanup

<details>
<summary><b>2.1</b> — <code>useFetch</code>'s effect claims three matrix rows: mount-only fetch (<code>[]</code>), dependency-driven refetch, and abort cleanup. There is only one effect and its deps are <code>[policyId]</code>. Which row is being oversold?</summary>

W2-D1-01, and the file says so out loud rather than hiding it.

The argument for keeping it: an effect with `[policyId]` runs exactly once on
first render, which *is* the mount-only case — `[]` is not a different lifecycle,
it is the degenerate case of the same one. Writing a second hook with a literal
`[]` purely to tick the box would fetch POL-1's claims once and then keep showing
them forever as the user navigates to POL-2, because React Router reuses the
`PolicyClaimsTab` instance across `/policies/:id/claims` rather than remounting
it. That is the exact bug the hook exists to prevent, shipped on purpose to
satisfy a checklist.

The concession worth making before it is extracted from you: nothing in this app
demonstrates a `[]`-deps effect for a *fetch*. There are `[]`-deps effects — the
interval in `useRenewalCountdown`, the keydown listener in `Modal` — and they
are the honest examples of "subscribe once, tear down on unmount". If the
reviewer wants a mount-only fetch specifically, the correct answer is that the
app has no feature that wants one, not that `useFetch` secretly is one.
</details>

<details>
<summary><b>2.2</b> — Without the <code>AbortController</code>, what exactly breaks, and why doesn't the <code>controller.signal.aborted</code> check in the <code>.then()</code> already handle it?</summary>

Without the controller: click POL-1, then POL-2 before the first request lands.
Both are in flight. Whichever settles second calls `setState` last, with no
relationship to what the URL now says. Half the time that is POL-1's claims
rendered under POL-2's heading, silently, with no error.

The `signal.aborted` guard alone is *not* sufficient, and the distinction is
worth being precise about: without the controller there is no `signal` to check
— the guard and the abort are the same mechanism, not two layers. What the guard
adds over `controller.abort()` alone is protection against the window where the
underlying promise has already resolved and queued its `.then` microtask before
the abort landed. `transport()` in `api.ts` rejects on abort, so most aborts
never reach `.then` at all; the guard covers the race where one does.

The second thing the abort buys, which the guard cannot: `transport` removes its
`abort` listener in the settle path. A long-lived signal that is never aborted
accumulates one listener per request, each closing over a resolved promise's
scope — a leak that grows for as long as the user stays on the page.
</details>

<details>
<summary><b>2.3</b> — <code>Toast</code>'s auto-dismiss effect keys on <code>[message]</code> and reads <code>onDismiss</code> from a ref. Why isn't the callback a dependency, when the linter wants it to be?</summary>

Because with it in the deps, the timer restarts on every parent render — which
is what shipped, and is why the ref is there now.

Both call sites pass an inline arrow (`onDismiss={() => setToastMessage(null)}`),
so the prop is a new function on every render of the parent. A new identity in
the deps means the effect tears down and re-runs every render: `clearTimeout`
followed by a fresh `setTimeout(4000)`, countdown back to zero. Any parent
re-rendering more often than every four seconds produces a toast that never
dismisses at all.

Neither parent currently re-renders on a timer, so the bug was latent rather
than visible — which is not a defence. `PolicyClaimsTab` is one poll or one added
countdown away from the toast becoming permanent, and the failure would be
attributed to the toast rather than to whatever started re-rendering.

The interesting part is that this is the *same* identity-churn class as the
`premiums` bug `PoliciesPage.tsx`'s header spends forty lines diagnosing —
caught there, missed here, in a five-line component. That is the honest lesson:
the pattern is recognisable once you have been bitten and invisible until then.

Three fixes were available — ref-and-drop, `useCallback` at both callers, or
keying the toast by message and letting it dismiss itself. Ref-and-drop is
right because it states the actual rule: "restart the countdown when the message
changes." `message` alone expresses that, and reading the callback at fire time
means a parent that swaps its handler mid-flight still gets the current one. Same
pattern `useFetch` uses, for the same reason.
</details>

<details>
<summary><b>2.4</b> — <code>EffectDepsDemo</code> passes <code>broken ? [query] : [true]</code> as its dependency array. React warns when a deps array changes size between renders. Why doesn't it warn here, and is the demo therefore fake?</summary>

It does not warn because both arrays have length 1 — React compares element
count, not identity of the array itself. Toggling `broken` swaps *which* value
sits at index 0, which is legal and is exactly what makes the toggle work.

The demo is not fake, but it is a scale model, and the difference is worth
stating: the real bug is `const query = {...}` in the render body landing in a
deps array, and that is genuinely what line 28 does — the object literal is
constructed on every render whether the toggle is on or off. The only thing the
toggle changes is whether that already-fresh object is *observed* by the effect.

What *is* softened: `RUN_CAP = 500`. A real occurrence has no cap and freezes the
tab. The cap is there so the lab panel does not brick the page it lives in, and
the on-screen text says so.
</details>

<details>
<summary><b>2.5</b> — <code>StrictMode</code> double-invokes every effect in development, so every log in this app prints twice and every fetch fires twice. That is noise in a demo whose whole point is reading the console. Why not turn it off for the walkthrough?</summary>

Because the doubling is the test, not the noise.

Mount → cleanup → mount is React deliberately exercising every cleanup path on
every effect. `useFetch`'s `AbortController`, `useRenewalCountdown`'s
`clearInterval`, `Modal`'s `removeEventListener`, `Toast`'s `clearTimeout` — each
one is asserted correct on every single mount, in development, for free. Turning
it off does not make the app faster; it makes a whole class of leak invisible
until production.

On the log-reading objection specifically: every comparison in
`docs/render-counts.md` is a *ratio* between a memoised side and an un-memoised
side. Doubling both sides leaves the ratio intact. And the tests render `<App>`
directly rather than through `main.tsx`, so the recorded numbers are the
undoubled ones — which is stated at the top of that document rather than left
for the reviewer to discover when the browser shows 280 where the table says 140.
</details>

---

## 3. `useRef` vs state

<details>
<summary><b>3.1</b> — <code>useRenewalCountdown</code> used to keep its interval id in a <code>timerRef</code>. It now uses a plain <code>const</code> inside the effect. Why was the ref wrong?</summary>

Because the cleanup an effect returns closes over that effect's own scope.

```ts
useEffect(() => {
  const timer = window.setInterval(...);
  return () => window.clearInterval(timer);
}, []);
```

is the whole thing. `timer` is visible to the cleanup and cannot be stale —
there is exactly one interval per effect run by construction. The ref added a
mutable slot, a null check and a manual reset to re-derive a guarantee the
closure already gave for free.

That is the general test, and it is worth stating as a rule rather than as a
verdict on one variable: **ref when the write frequency and the render frequency
differ; state when they are the same; neither when a closure variable already
scopes it correctly.** The interval id is written once per effect run and read
once per cleanup, by code inside that run — it fails the test.

A ref where a closure variable suffices is the ref equivalent of a cargo-cult
`useMemo`, and it is the most common way `useRef` gets misused by someone who has
just learned what it is for. The matrix's W2-D2-02 now rests on
`lastActivityRef` alone, which earns it decisively — see 3.2.
</details>

<details>
<summary><b>3.2</b> — Make the case for <code>lastActivityRef</code> being a ref, in terms of what the user would see if it were state.</summary>

It is written on every `mousemove`, `keydown` and `click`. As state, each of
those is a `setState`, so resting the mouse anywhere on `/policies/:id` re-renders
the policy detail page dozens of times a second — including the summary card, the
coverage table and the countdown.

An idle detector that makes the page busy while the user is idle has inverted its
own purpose. The ref lets the write happen at pointer frequency and the *read*
happen once per second, inside the interval tick, where a single `setSnapshot`
is genuinely warranted because the clock on screen has changed.

That is the general shape of the rule: ref when the write frequency and the
render frequency are different, state when they are the same.
</details>

<details>
<summary><b>3.3</b> — <code>usePrevious</code> writes to a ref <em>during render</em>. React documentation calls render functions pure and warns against side effects in them. Defend the violation.</summary>

It is not a violation of the rule that matters. The rule forbids effects
*observable outside the component* during render — no DOM writes, no network, no
mutating shared state. Writing to a ref this component owns is none of those: it
is component-local, invisible to every other component, and — critically — safe
under concurrent rendering's discard-and-retry, because a retried render reads
the same `value` and takes the same branch, arriving at the same result.

What it buys is the thing the effect version cannot: no lag. The alternative,
`const [prev, setPrev] = useState(value); useEffect(() => setPrev(value),
[value])`, renders the *new* premium next to a `prev` that has not caught up,
then re-renders once the effect lands. `StickyPremiumSummary` would flash "was
₹0" for one frame on every keystroke. The ref version has the previous value
available in the very render that needs it, because this render's write only
takes effect for the next one.
</details>

<details>
<summary><b>3.4</b> — <code>Modal</code> holds <code>isOpen</code> in <code>useState</code> but exposes <code>open()</code>/<code>close()</code> through a ref. That is state driving the render and a ref driving the API. Why not one or the other?</summary>

Because they answer different questions. `isOpen` must be state: it decides what
renders, so React must know when it changes. The *handle* must be a ref: the
caller needs a way to trigger the change from a click handler without owning the
flag.

The alternative — a `isOpen` prop threaded down from a parent `useState` — means
every trigger site re-implements the same open/close state, and `ClaimIntakePage`
and `PolicyClaimsTab` each grow a `useState` whose only job is to be passed
straight back down. Worse, the parent then re-renders on every open and close,
taking its whole subtree with it, to change something only the modal cares about.

The ref handle keeps the state where the state belongs and gives the caller a
verb instead of a variable.
</details>

<details>
<summary><b>3.5</b> — <code>PolicyClaimsTab</code> uses <code>lastRowRef</code> with <code>flushSync</code> to scroll to a newly appended row. You could have used <code>useEffect</code> and scrolled after the render. Why the more dangerous tool?</summary>

An effect would work here, and that is worth conceding — this is the weaker of
the two `flushSync` arguments.

The stronger one: the scroll and the append belong to the same user gesture, and
splitting them across a render boundary means the effect must reconstruct *which*
row to scroll to. It fires on every render of the tab, so it needs a guard —
compare lengths, or track the last-appended id in another ref — and that guard is
the bug surface. `flushSync` keeps the two lines adjacent: append, then scroll to
the row that append just created, in one function the reader can verify by
reading downward.

The honest cost, which should be stated before it is extracted: `flushSync`
forces a synchronous re-render of the whole subtree and opts that update out of
batching. On a claims table of a dozen rows that is free. On the 140-row policy
table it would be exactly the wrong tool, which is why it is here and not there.
</details>

---

## 4. Context re-render behaviour and the split-context decision

<details>
<summary><b>4.1</b> — <code>QuoteContext</code> is split into <code>QuoteStateContext</code> and <code>QuoteDispatchContext</code> so that dispatch-only consumers don't re-render. Name a dispatch-only consumer.</summary>

**⚠ WEAK SPOT.** There isn't one.

Every consumer in `QuoteWizardPage` — `WizardNav`, `ApplicantStep`, `RiskStep`,
`CoverageStep`, `ReviewStep` — calls both `useQuoteState()` and
`useQuoteDispatch()`. The split therefore saves exactly zero renders today.

And it would still save zero if a dispatch-only step existed, for a second and
more interesting reason: `QuoteWizardPage` itself calls `useQuoteState()` and
renders every step inline. A context value change re-renders the *provider's
consumers*, but the parent re-rendering re-renders its children regardless of
what contexts they read. A dispatch-only child of a state-reading parent
re-renders anyway. Making the split pay off needs `React.memo` on the step
components too, and none of them have it.

The pattern is correct in general and the header describes its mechanism
accurately. What the header claims that is not true of *this* app is the benefit.
The defensible framing is: "this is the shape I would use, and in this app it is
currently inert — here is what it would take to make it real."
</details>

<details>
<summary><b>4.2</b> — <code>AuthProvider</code> wraps its value in <code>useMemo</code>. Its only state is <code>role</code>, and the value depends on <code>role</code>. When can that memo ever bail out?</summary>

Never, in the current tree — and this is a softer version of the same problem as
4.1.

`AuthProvider` re-renders only when `role` changes, because nothing above it in
`App.tsx` re-renders. And when `role` changes, the value *must* change. So the
memo's bail-out branch is unreachable.

Two things keep it from being pure cargo cult. First, it is correct-by-
construction against a future where `AuthProvider` gains a second piece of state,
or where `App` starts re-rendering — both of which turn a missing memo into a
real bug that is hard to attribute. Second, `switchRole` is wrapped in
`useCallback` for the same reason, and *that* one matters more: without it the
value's identity would churn on every provider render regardless of the memo.

The claim in the file's header — "every render of `AuthProvider` hands consumers
a brand-new object" — is describing a general hazard, not something this app
currently does. Say it that way rather than as a fact about this tree.
</details>

<details>
<summary><b>4.3</b> — Why is <code>AuthContext</code> exported when the codebase's own convention is to hide context objects behind a guarded hook?</summary>

Because `use()` needs the context object and `useAuth()` cannot be called
conditionally.

`PolicySummaryCard` reads the role only inside `if (policy.status === 'lapsed' ||
policy.status === 'cancelled')`. `useAuth` wraps `useContext`, so it obeys the
rules of hooks and must be called unconditionally at the top — which subscribes
*every* policy card to auth, including the ~85% that are active and never render
the reinstatement note. Flipping the role in the header would then re-render
every card in the book to change nothing.

`use()` has no such rule. Called inside the branch, it registers the context
dependency only on renders that take the branch.

So `useAuth` stays the right call everywhere the read is unconditional — it keeps
the missing-provider guard — and the raw context is exported for exactly the one
call site that needs the conditional read. The export is a named exception with a
reason attached in its own doc comment, not a hole in the convention.
</details>

<details>
<summary><b>4.4</b> — A reviewer says: "Context is not a state manager. You have a reducer plus context doing global state, which is the thing everyone tells you not to do." Answer them.</summary>

They are describing a real failure mode and misapplying it.

The warning is about *unscoped* context state: one provider at the root holding
everything, so any change re-renders everything, with no way to subscribe to a
slice. That is where "context is not a state manager" bites, and it is why Redux
and Zustand exist — they provide selector-level subscription that context cannot.

`QuoteProvider` is not that. It is mounted on the `/quote` route only (see
`App.tsx`), holds one draft, and is consumed by four step components that all
need most of it. There is no slice to subscribe to; the state is small and
cohesive and its lifetime matches the route's.

The place the criticism lands is scale: the moment a second concern moves into
that provider — say, an underwriting queue — the split-context arrangement in 4.1
stops being decorative and starts being insufficient, because two unrelated
things would share one re-render. That is the point at which a selector-based
store earns its dependency. Not before.
</details>

<details>
<summary><b>4.5</b> — <code>QuoteProvider</code> is deliberately placed <em>outside</em> the route's <code>&lt;Suspense&gt;</code>. What breaks if it goes inside, and how would you notice?</summary>

`initQuoteDraft` re-runs and the in-progress draft is silently replaced by
whatever was last persisted.

Mechanism: a Suspense boundary unmounts its children while showing the fallback.
A provider inside the boundary is one of those children, so it unmounts and
remounts every time the chunk suspends. `useReducer`'s lazy initialiser runs on
mount — that is its entire contract — so remounting re-reads `localStorage` and
rebuilds the draft from disk.

How you notice: badly. The persistence effect writes on every state change, so
the reload usually returns something close to what was there, and the bug looks
like an occasional lost field rather than a remount. The reliable tell is that
`step` resets — a wizard that jumps back to "Applicant" after a suspension is the
symptom, and the cause is three files away in the route table.

This is the general rule the file states: anything whose *identity across
suspensions* matters goes outside the boundary. State goes outside; the thing
that suspends goes inside.
</details>

---

## 5. `useReducer` vs `useState`

<details>
<summary><b>5.1</b> — The quote wizard has ~10 fields. Ten <code>useState</code> calls would be simpler and every step already destructures what it needs. Why a reducer?</summary>

Because the transitions are not independent, and `useState` has no vocabulary for
that.

`SET_TYPE` does not only set `type` — it clears `selectedCoverageCodes`, because
those codes belong to the previous type's catalogue and a health rider riding
along on a motor quote is a real defect. With ten `useState` calls that rule
lives in the `onChange` handler of one `<select>` in `ApplicantStep`, where the
next person to add a type-dependent field will not find it. In the reducer it
lives next to every other transition, in one switch that can be read top to
bottom as the complete list of things that can happen to a quote.

The secondary reason is `dispatch`'s referential stability, which is what makes
the split context in 4.1 *possible* even though this app does not yet cash it in.

The threshold, stated plainly so it does not sound like a rule of thumb: reach
for a reducer when one user action must change more than one piece of state
according to a rule, and the number of such actions is growing.
</details>

<details>
<summary><b>5.2</b> — The <code>mutating-reducer</code> defect pushes onto <code>state.insured</code> and returns <code>state</code>. Walk through exactly what the user sees, including why it is <em>two</em> rows and not one.</summary>

Click "Add insured party" with the toggle on: nothing appears. `useReducer`
compares the returned state to the previous state with `Object.is`, sees the
identical reference, and skips the re-render entirely — even though `party` really
is in `state.insured` and DevTools would show it.

Switch steps and back, forcing an unrelated action through that *does* return a
fresh object. Now two rows appear, not one.

The doubling is `StrictMode`. React double-invokes reducers in development
specifically to surface impurity, and the two invocations are supposed to be
indistinguishable. A pure reducer computes the same result twice and you cannot
tell. A mutating one *pushes twice* — the mutation is a side effect, and side
effects really do happen once per invocation.

That is the part worth having ready: the doubling is not React being weird, it is
React's impurity detector firing, and the fact that you can see it is the whole
reason the check exists.
</details>

<details>
<summary><b>5.3</b> — <code>useReducer</code>'s lazy third argument rehydrates from <code>localStorage</code>. Why not just <code>useReducer(quoteReducer, readDraft())</code>?</summary>

Because the second argument is evaluated on every render, not just the first.

`useReducer(quoteReducer, readDraft())` calls `readDraft()` — a synchronous
`localStorage.getItem` plus a `JSON.parse` — on every single render of
`QuoteProvider`, which is every keystroke in every field of the wizard. React
*discards* every result but the first, so the work is not just wasteful, it is
invisible: the app behaves correctly and the reads never show up as a bug, only
as a profile.

`useReducer(quoteReducer, undefined, initQuoteDraft)` passes the function and lets
React call it once, on mount.

Same distinction as `useState(expensive())` versus `useState(() => expensive())`,
which is why `useLocalStorage` takes the lazy form too — and both files' headers
say so, because it is the single most commonly-missed form in the API.
</details>

<details>
<summary><b>5.4</b> — Reducers must be pure, yet <code>quoteReducer</code> calls <code>nowIso()</code> and <code>crypto.randomUUID()</code>. Those are impure. Is the reducer broken?</summary>

Yes, strictly, and it is worth conceding before defending.

Under `StrictMode` the reducer is invoked twice and React keeps the second
result, so `ADD_INSURED` generates two UUIDs and discards one, and `updatedAt`
gets the second timestamp. Neither is observable — the keys are only used as
React `key`s and for identity within the array, and the timestamps differ by
microseconds — so the impurity is benign *here*.

Where it would stop being benign: if a UUID were ever used as an idempotency key
for a network write, or if `updatedAt` were compared for equality against a
server copy. Then the discarded first invocation and the kept second one diverge
in a way something downstream can see.

The clean version generates the id and the timestamp in the *action*
(`dispatch({ type: 'ADD_INSURED', key: crypto.randomUUID(), at: nowIso() })`) and
leaves the reducer a pure function of `(state, action)`. That is the correct
answer to give, rather than arguing that this particular impurity is harmless —
because "harmless today" is the argument every impurity makes right up until it
is not.
</details>

<details>
<summary><b>5.5</b> — <code>QuoteProvider</code> persists the draft in a <code>useEffect</code> keyed on <code>[state]</code>. Why not write to <code>localStorage</code> inside the reducer, where the state change actually happens?</summary>

Because that would be the impurity in 5.4 with teeth.

Under `StrictMode` the reducer runs twice, so the write runs twice — and unlike a
discarded UUID, a `localStorage.setItem` is not discarded. More importantly, the
reducer also runs during renders React may throw away entirely under concurrent
rendering: an interrupted render's reducer results are recomputed, and a write
that already hit disk cannot be recomputed away. You would be persisting states
the user never saw.

Effects run after commit, once, on states that actually made it to the screen.
That is the guarantee "synchronise with something outside React" requires, and
persistence is the textbook case of it.

The related question, which is the interesting one: why an effect and not just a
call inside the event handler? Because there are twelve action types and the
persistence rule is "whenever the draft changes", not "whenever these twelve
handlers fire". Keying an effect on `[state]` states the rule once; the handler
version restates it twelve times and gets it wrong on the thirteenth.
</details>

---

## 6. `lazy` / `Suspense` boundary placement

<details>
<summary><b>6.1</b> — There are eleven <code>&lt;Suspense&gt;</code> boundaries in this app and none at the root. One at the root would be four lines. Why the eleven?</summary>

Because a fallback replaces everything below its boundary, so boundary placement
*is* the definition of what disappears.

At the root: navigating from `/policies` to `/quote` blanks the sidebar, the
header and the role switcher for the duration of the chunk load. The user's own
click target vanishes, and there is nothing on screen indicating which route is
loading or how to go back.

Per route, inside `AppLayout`'s `<Outlet>`: the chrome stays, only the content
region swaps, and the fallback can be shaped like the page it replaces —
`Skeleton variant="table"` for the policy book, `variant="card"` for the detail
page — which is only possible because each boundary knows what is behind it. A
root boundary can only ever show a generic spinner.

Per *tab* under `/policies/:id` is the same argument one level down and is the
one people miss: tab chunks resolve into the parent's `<Outlet>`, so with only
the parent wrapped, clicking "Claims" unmounts the policy header, the renewal
countdown and the tab nav — including the link just clicked — and the countdown's
interval restarts from zero on every tab switch.
</details>

<details>
<summary><b>6.2</b> — In <code>LazyRoute</code>, <code>&lt;ErrorBoundary&gt;</code> wraps <code>&lt;Suspense&gt;</code>. Swap them and describe the failure.</summary>

The rejection lands nowhere.

`React.lazy` throws its import rejection *at render*, and Suspense does not catch
rejections — only suspensions. So the boundary has to be above the Suspense to
see the throw at all.

There is a second reason that survives even if you get the first one right by
accident: the boundary must *outlive* the fallback. When the promise rejects,
React tears down the fallback and re-renders, and the throw happens during that
re-render. A boundary nested inside the Suspense is part of what gets torn down,
so it is not mounted at the moment it would need to catch.

Practical consequence of getting it wrong: a chunk that fails to load on a stale
deploy takes the tree to the root and leaves a white page — which is the
pre-boundary behaviour, achieved with a boundary present. That is the worst kind
of bug, because the code review sees a boundary and stops looking.
</details>

<details>
<summary><b>6.3</b> — Code splitting was supposed to shrink the entry chunk. <code>src/shared/data</code> — the seed generator for 140 policies, 60 claims and 463 documents — is still in it. Explain, and say whether you tried to fix it.</summary>

`AppLayout` renders on every route and reads `AS_OF` from `src/shared/data` for
the valuation-date line in the header. `AppLayout` is a static import in
`App.tsx`. A module reachable from a statically-imported component cannot be in a
lazy chunk — one static import anywhere pins the entire module graph beneath it.

This is the failure mode to look for whenever a split "did not seem to help": the
route chunks shrink, the entry chunk does not, and the cause is always one
innocuous import in shared chrome. `React.lazy` splits where the imports are, not
where the intent is.

Not fixed, deliberately, and the reasoning is recorded in `lazyRoutes.tsx`'s
header rather than omitted: the seed module is a *generator* — a few kB of code,
not 140 policies of JSON — and every route needs it anyway. It was measured
against `vite build` before being accepted rather than assumed away. The fix, if
the numbers had said otherwise, is to move `AS_OF` into its own leaf module that
carries no dependencies.

What did move, and is the biggest win: `rating.ts` left the entry chunk for
`PoliciesPage`'s.
</details>

<details>
<summary><b>6.4</b> — <code>ClaimIntakeWizard</code> is lazy-loaded inside a modal. What single property of <code>Modal</code> makes that work, and what innocuous refactor silently breaks it?</summary>

`Modal` returns `null` while closed.

React does not load a lazy component because its element was *created* —
`ClaimIntakePage` constructs `<ClaimIntakeWizard />` on every render — it loads it
when the element is *rendered*. An unmounted subtree never renders, so the import
never fires.

The refactor that breaks it: implementing the modal as `<div hidden>` or
`style={{ display: 'none' }}` around its children. Both are conventional, both
look identical on screen, and both mount the subtree — so the wizard's chunk
downloads on page load and the split becomes nominal while every visible
behaviour stays correct.

`App.test.tsx` asserts against exactly this: it renders `/claims/new` and checks
that the wizard's heading is *not* in the document. A hidden-but-mounted modal
fails that assertion. It is the only kind of check that catches this class of
regression, because nothing about it is visible.
</details>

<details>
<summary><b>6.5</b> — Preloading on hover is a micro-optimisation on a demo app with no real network. Justify the <code>lazyRoutes</code> indirection instead of <code>onMouseEnter={() =&gt; import('./X')}</code>.</summary>

Two things, and the second is the real one.

The mechanical answer: `React.lazy` swallows its loader. Once the import function
goes into `lazy()` there is no handle on it, so preloading needs the loader kept
somewhere — which is what `splitChunk` does by wrapping and returning all three parts (`Component`, `preload`, `reset`).
And the nav needs to reach it *without* re-declaring the import paths, or the two
copies drift and the sidebar quietly preloads a module nobody renders any more.

The real one: `start()` memoises and *logs which kind of call each one was*. The
naive inline version deduplicates the network fetch via the browser's module
cache, so it is not a bandwidth bug — it is worse than that. Every call resolves
identically whether it started a download or found one already finished, so there
is no way to tell from the outside whether the preload did anything at all. The
paired console lines — `↓ PoliciesPage (preload)` on hover, then `⤳ PoliciesPage
already requested (render)` on click — are what make the optimisation *observable*
rather than merely plausible.

And `onFocus` alongside `onMouseEnter`, because a keyboard user never fires
`mouseenter` and would otherwise take the slow path on every navigation while
mouse users took the fast one — an accessibility regression introduced by a
performance feature.
</details>

---

## 7. Error boundary retry semantics

<details>
<summary><b>7.1</b> — Retry sets <code>error: null</code> and bumps <code>attempt</code>, used as a <code>key</code>. Why isn't clearing the error enough?</summary>

Because the thing that failed is remembered outside the boundary's state.

`getPolicyResource(id)` returns a *cached promise*. If it rejected, the Map still
holds the rejected promise. Clearing the error re-renders the same child, which
calls `getPolicyResource(id)` again, gets the same settled rejection, and `use()`
throws it again — synchronously, before the browser paints. The fallback does not
even flicker. From the user's side the button does nothing at all, which is the
most confusing possible failure.

The `key` bump gives React an element with the same type and a different key,
which it treats as a different instance: the old fiber and its memoised failure
are discarded rather than reconciled with.

`ErrorBoundary.test.tsx` pins this. Change `<Fragment key={attempt}>{children}
</Fragment>` to `{children}` and every manual check still passes — the fallback
appears, the button is clickable, the error clears — while nothing recovers.
</details>

<details>
<summary><b>7.2</b> — The key bump handles the fiber. What handles the module-level <code>Map</code>, and why does the ordering inside <code>handleRetry</code> matter?</summary>

`onRetry`, which callers wire to `clearPolicyResource(id)`. A module-level Map is
not part of any fiber, so no remount can reach it.

Ordering: `this.props.onRetry?.()` runs *before* `this.setState(...)`. The state
update triggers the remount, and the remounted child re-renders immediately — if
the rejected promise is still in the Map at that moment, it throws again before
the handler has even returned. Evict first, then remount.

`ErrorBoundary.test.tsx`'s fourth test fails on ordering specifically, not just
on omission: the stand-in child throws while `cachePoisoned` is true, and only
`onRetry` clears it. Reversing the two lines makes that test fail while the other
three still pass.

Two mechanisms, two caches. Drop either and the button is decorative — the file's
own word.
</details>

<details>
<summary><b>7.3</b> — A route's chunk fails to download and the boundary offers a Retry. Prove it recovers.</summary>

`src/shared/routes/lazyRoutes.test.tsx` proves it, and the test exists because
for two phases it did **not** recover.

The bug: `ErrorBoundary`'s header claimed the `key` bump clears `React.lazy`'s
memoised rejection alongside the fiber. It does not. `React.lazy` stores its
outcome on a payload object attached to the lazy component itself — module
scope, not fiber scope — so once that payload is `Rejected`, every subsequent
read re-throws the stored error without re-requesting anything. Remounting reads
the same payload. `lazyRoutes` added a second, independent layer of the same
problem: its `pending` promise was memoised per chunk and never cleared.

Measured, not reasoned about. A probe rendering a rejecting `lazy()` inside this
boundary recorded `import attempts: 1 before retry, 1 after · recovered? false ·
still showing fallback? true`. And `App.tsx` compounded it by passing no
`onRetry` at all, so every route Retry button was decorative — the precise
failure that file's own header identifies and claims to avoid.

The fix, and the reason it is three things and not one:

- `reset()` in `splitChunk` nulls `pending` **and** re-creates the `lazy()`
  component. Either alone is insufficient: clearing `pending` leaves the
  rejected payload on the old component; re-creating the component alone gets
  handed the same memoised rejected promise by `start()`.
- `Component` is a plain wrapper that reads the current lazy component **at
  render time** rather than being it. Without that indirection the route table's
  element captures whichever lazy object existed when `App` rendered, and
  `reset()` swaps a variable nothing reads.
- `App.tsx`'s `BoundedRoute` and `ClaimIntakePage` both pass `reset` as
  `onRetry`. `BoundedRoute` takes the whole `SplitChunk` rather than a component
  and a reset separately, so the two cannot drift apart.

The test asserts `loaderCalls` moves from 1 to 2, not just that the content
appears — the counter is what fails if `reset()` stops re-creating the
component, which was verified by sabotaging that line and watching the test go
red. A second test keeps the broken arrangement as an executable record: if a
future React makes remounting re-run a rejected loader on its own, *that* test
fails, and the failure means `reset()` has become unnecessary rather than that
something broke.

`RiskExposurePanel` and `PolicyDetailPage` were never affected: they wire real
`onRetry` handlers against the promise cache, which *is* evictable.
</details>

<details>
<summary><b>7.4</b> — <code>ErrorBoundary.test.tsx</code>'s comment says a child that throws only on its first render never reaches the boundary. That contradicts how boundaries are usually described. Explain.</summary>

When a concurrent render throws, React discards that render and immediately
re-renders the whole root *synchronously*, to produce a reliable error with a
usable component stack. A child that fails exactly once therefore succeeds on
that automatic second attempt, and the boundary is never engaged — the test would
render "recovered" with no fallback and no Retry button to click.

Writing the test surfaced this; it was not known in advance. The workaround —
a deterministic failure gated on external state (`poisoned`, `cachePoisoned`) —
turned out to be the *more* faithful model anyway: a poisoned cache entry does
not heal itself on a re-render either, and that is precisely the case Retry
exists for.

The general lesson, which is the answer to give: "throws once" and "throws until
something changes" are different failure classes, and only the second one is what
error boundaries are for. A boundary is not a try/catch around a flaky render.
</details>

<details>
<summary><b>7.5</b> — <code>RiskExposurePanel</code>'s <code>onRetry</code> calls <code>clearPolicyResource(policyId)</code>, which also deletes the risk-feed entry. But <code>PolicySummaryCard</code> — outside this boundary — is still holding that policy's detail. What did you just do to it?</summary>

Evicted a promise a sibling is still using, across a boundary that was supposed
to contain the blast radius.

What actually happens is benign: `PolicySummaryCard` already resolved and
committed, and eviction does not re-render it, so it keeps rendering the value it
has. The next component to call `getPolicyResource(policyId)` creates a *new*
promise and a second `[api] →` line appears for a detail nobody asked to reload.

Two things are wrong with it, in ascending order of seriousness. The name:
`clearPolicyResource` deletes from `riskFeedCache` as well as
`policyResourceCache`, which is not what the name says and is discoverable only
by reading the body. And the scope: a widget-level retry reaches outside its own
boundary to invalidate shared state. Today the sibling happens not to care. A
sibling that re-rendered for any unrelated reason would suspend again on a fresh
promise, showing a skeleton because a different widget's Retry button was pressed.

The correct version is a `clearRiskFeed(policyId)` that evicts only what this
boundary owns, with `clearPolicyResource` left for the boundary in
`PolicyDetailPage` that actually owns the detail. The general rule: eviction scope
should match boundary scope, or the boundary is not containing what it claims to.
</details>

---

## 8. `useLayoutEffect` vs `useEffect`

<details>
<summary><b>8.1</b> — Both effects eventually set the same value. Why does it matter which one does it?</summary>

Which side of the paint the assignment lands on.

`useLayoutEffect` runs synchronously after the DOM is mutated and *before* the
browser paints. If it sets state, React re-renders and re-commits inside the same
phase, so exactly one paint happens and it already shows the measured position.

`useEffect` runs after paint. The browser paints once with `FALLBACK_TOP_PX` — 0,
chosen to be nowhere near the real offset, so the panel renders flush against the
top of the viewport overlapping `AppLayout`'s header — then the passive effect
runs and a second paint snaps it down.

The user sees a jump. The value is identical either way; only the timing differs,
and timing is the entire user-visible behaviour.
</details>

<details>
<summary><b>8.2</b> — The console prints milliseconds between commit and correction. Why does the file say not to trust that number?</summary>

Because `getBoundingClientRect()` forces a synchronous layout, and on a busy
first commit that reflow alone costs several milliseconds — *inside* a layout
effect. "Before paint" is not "instant", so the two branches' millisecond figures
can overlap, and a reviewer reading only the numbers could conclude the toggle
does nothing.

The reliable signal is the explicit `before paint` / `after paint` tag on each
log line, because that reflects a guarantee the browser actually makes — layout
effects always run and can re-commit before the next paint; passive effects never
run before the first one — rather than a timing measurement that varies with
machine load.

This is the more useful half of the answer generally: when demonstrating a
guarantee, log the guarantee, not a proxy for it that happens to correlate.
</details>

<details>
<summary><b>8.3</b> — The component used <code>position: sticky</code> first and it was changed to <code>fixed</code> for the demo. Isn't changing the CSS to make the bug visible exactly the contrivance CLAUDE.md forbids?</summary>

It would be, if the CSS had been chosen to *manufacture* a difference. It was
changed because `sticky` was hiding a difference that was really there.

A `position: sticky` element's `top` is a scroll-triggered clamp — it only affects
rendering once the page has scrolled far enough that the element's normal-flow
position would cross above that offset. This wizard is four short steps and never
scrolls that far, so the element sat at its ordinary in-flow position regardless
of what `top` held. A Playwright probe confirmed the rendered rect was
bit-for-bit identical with the toggle on and off, *even though the two `top`
values genuinely differed*.

So under `sticky` the component was measuring a value that nothing rendered. That
is a bug in the component independent of any demo: it did work, stored the
result, and the result had no effect. `fixed` applies `top` on every paint
unconditionally, which makes the measurement load-bearing.

The contrivance test is: does the component still make sense with the lab toggle
deleted? It does — a premium bar docked under a variable-height header needs a
measured offset either way.
</details>

<details>
<summary><b>8.4</b> — The measurement is a <code>getBoundingClientRect</code> on every resize plus a state update. <code>position: sticky</code> with a CSS custom property, or a CSS-only layout, needs none of that. Why is JavaScript measuring layout at all?</summary>

This is the strongest attack in this section and it deserves a concession first:
for *this specific* layout, CSS could do it. A grid or flex column with the bar as
a sibling of the header, or `position: sticky; top: 0` on a correctly-structured
container, gets the bar docked under the header with zero JavaScript, zero reflow
and zero state.

What JavaScript buys is reading a value CSS can compute but not *expose*: the
header's rendered height as a number, usable by something that is not its sibling.
The moment the bar needs to live outside the header's layout context — a portal,
a different stacking context, a sticky element inside a `transform`ed ancestor
(which `Panel` creates) — the CSS solution stops being available and the measured
one is the only one left.

So the honest positioning is: this component demonstrates the
`useLayoutEffect` mechanism on a layout where CSS would also have worked, chosen
because it is the simplest layout where the before-paint/after-paint distinction
is *visible*. A layout complex enough to force the measurement would have made
the demo about the layout instead. That trade is worth naming rather than
pretending the CSS route does not exist — the reviewer knows it does.
</details>

<details>
<summary><b>8.5</b> — Both effects are called unconditionally and each returns early based on the toggle, rather than one <code>if</code> choosing between them. Why?</summary>

Because the alternative violates the rules of hooks.

```ts
if (useEffectInstead) useEffect(...); else useLayoutEffect(...);
```

changes which hooks are called between renders. React tracks hooks by call order,
not by name, so flipping the toggle changes the count and shape of the hook list
and React throws "Rendered more hooks than during the previous render" — the
`ConditionalHookDemo` crash, in production code.

Calling both and gating the *bodies* keeps the call order fixed. The toggle is in
the deps array (`[useEffectInstead]`), so flipping it re-runs both effects, one of
which returns immediately and one of which measures.

This is the same pattern `EffectDepsDemo` and `StaleClosureDemo` use, and it
generalises: a hook's *call* is unconditional, its *work* can be conditional.
</details>

---

## 9. `forwardRef` / `useImperativeHandle`

<details>
<summary><b>9.1</b> — React 19 lets function components take <code>ref</code> as a plain prop. <code>forwardRef</code> is on its way out. Why is it still here?</summary>

Two answers, and the second is the one that matters.

The version answer: `forwardRef` is deprecated, not removed, in React 19 — it
still works and is what the pinned `@types/react` 19 types cleanly for a
component that also declares an imperative handle. Rewriting to `ref`-as-prop is a
mechanical change with no behavioural difference.

The substantive answer: `forwardRef` is not the interesting half of this file.
`useImperativeHandle` is, and it is unaffected by the deprecation — it is how the
ref stops being a DOM node and becomes an API. Whether the ref arrives via
`forwardRef` or as a prop, the handle is still `{ open, close, focusFirst }` and
the design question — verb-based handle versus boolean prop — is identical.

If the reviewer's point is "you should have written the modern form", the right
response is to agree and note that the row it claims (W3-D4-05) names
`forwardRef` explicitly, so the older form is what the curriculum asked to see.
</details>

<details>
<summary><b>9.2</b> — <code>useImperativeHandle</code> is an escape hatch. You could have used <code>isOpen</code> as a prop. Why is the escape hatch the right call here?</summary>

Because the state has exactly one owner and every alternative gives it two.

With `isOpen` as a prop, both `ClaimIntakePage` and `PolicyClaimsTab` grow a
`useState<boolean>` whose only purpose is to be handed straight back down to the
modal. Each trigger site re-implements the same open/close logic, with its own
chance to get "close on submit" and "close on cancel" out of sync. And the parent
re-renders on every open and close, taking its whole subtree with it, to change
something only the modal cares about — on `PolicyClaimsTab` that subtree includes
the claims table.

The handle inverts it: the modal owns `isOpen`, the caller gets `open()` and
`close()`. The caller does not re-render when the modal opens.

Where the escape hatch would be wrong: if the open state needed to be
URL-addressable, shared with a sibling, or restored on reload. Then it is
application state and belongs where application state goes. "Which dialog is
currently open" is not that.
</details>

<details>
<summary><b>9.3</b> — <code>useImperativeHandle</code>'s dependency array is <code>[]</code>, but <code>focusFirst</code> is redefined on every render and closes over <code>containerRef</code>. Is that stale?</summary>

No, and the reason is worth being precise about.

The handle object is created once and captures the `focusFirst` from the *first*
render. That closure reads `containerRef.current` at call time, and `containerRef`
is a ref — the same object across every render, with a `.current` that is always
up to date. So the captured function reads current DOM even though the function
itself is stale.

`open` and `close` are the same story via `setIsOpen`, which React guarantees is
stable.

Where `[]` *would* bite: if any handle method closed over a prop or a state value
directly. `close: () => { onClose(); setIsOpen(false); }` with `onClose` from
props would call the first render's `onClose` forever. The rule that makes `[]`
safe here is that every value the handle reads is reached through a stable
container — a ref or a setter — never captured by value.
</details>

<details>
<summary><b>9.4</b> — <code>TextField</code> deliberately does not use <code>forwardRef</code>, yet the matrix row for W3-D4-05 names it. Reconcile that.</summary>

The row's "feature that forces it" column names both `Modal` and `TextField`; the
"file / export" column names only `Modal`, with the exclusion documented in
`TextField`'s own header.

The reason for excluding it: nothing in the app grabs a `TextField`'s DOM node
directly. The one place focus is programmatically moved is `Modal`'s
`focusFirst()`, and that works by `querySelectorAll` over the dialog's container
for anything focusable — it does not need a ref to any particular field, and it
keeps working when a field is added, removed, or replaced by a `<select>`.

Adding `forwardRef` to `TextField` with no caller would be a prop that exists for
the matrix rather than for the app — exactly the contrived usage the prime
directive rules out. The bookkeeping inconsistency is real but it is a
row-description problem, not a coverage gap: the concept is demonstrated once, in
the place that needs it.
</details>

<details>
<summary><b>9.5</b> — Handle a reviewer who says: "an imperative modal handle is a 2018 pattern; the declarative version is easier to test and easier to reason about."</summary>

Agree on testing, disagree on reasoning, and be specific about the boundary.

They are right that `<Modal open={isOpen}>` is easier to test — you set a prop and
assert. The ref handle needs a rendered parent that holds the ref, so the test is
an integration test whether you wanted one or not.

Where they are wrong is "easier to reason about". The declarative version does not
remove the state, it *relocates* it to a component that has no interest in it, and
then requires that component to re-render whenever it changes. With two call
sites, that is two copies of the same open/close logic and two subtrees that
re-render on every open.

The real boundary is ownership, not style. If the open state is meaningful to the
application — reflected in the URL, restored on reload, read by a sibling — it is
application state and the declarative form is correct. If it is meaningful only
to the dialog, the handle keeps it there. "Log claim opens a dialog" is the second
kind.
</details>

---

## 10. `use()` vs `useEffect` fetching

<details>
<summary><b>10.1</b> — Why does the app keep both paths instead of migrating everything to <code>use()</code>?</summary>

Because they make different trades and both trades are live in this app, one tab
apart on the same page.

`use()` + cached promise (`PolicySummaryCard`): no `loading`, no `error`, no
nullable `data`. `detail` is `PolicyDetail`, full stop — a render that reaches
line one already has the data, because a render that did not never got past
`use()`. Cost: the promise must be cached to be stable across renders, and a
cached promise cannot be aborted, because aborting it would reject it for every
other consumer *and* the rejection is cached, leaving the policy broken for the
rest of the session.

`useEffect` + `AbortController` (`PolicyClaimsTab`): three states every consumer
must branch on, and `data` typed nullable forever. Buys real cancellation — click
POL-1 then POL-2 and the first request is genuinely aborted rather than racing.

Cancellation belongs to the abortable path; caching belongs to the other. Putting
them on the same route, one tab apart, is what makes the trade demonstrable
rather than described.
</details>

<details>
<summary><b>10.2</b> — <code>use(fetchPolicy(id))</code> is the obvious spelling and it is forbidden. Walk the failure precisely.</summary>

`fetchPolicy(id)` is called *during render*. React suspends on the returned
promise. When it settles React re-renders. The render body runs again.
`fetchPolicy` is called again. A brand-new promise is thrown. React suspends
again.

The component never commits and the network tab fills up forever.

`use()` is only safe against a promise whose *identity* is stable across renders,
which is what `api.ts`'s Map provides — `getPolicyResource(id)` returns the same
object every time.

The proof is in the console and needs no special demo: `[api] → GET
/policies/POL-00007/detail` prints exactly once per policy per session, while
`[render] PolicySummaryCard` and `[api] ⤳ cache hit` print together on every
re-render — every tab switch, every toggle of the cover-detail disclosure.
Renders climb, real requests do not. Remove the cache and every `⤳` becomes a `→`.
</details>

<details>
<summary><b>10.3</b> — <code>use(AuthContext)</code> inside an <code>if</code>. What does that actually buy, quantified?</summary>

It stops ~85% of policy cards from subscribing to auth at all.

`useAuth` wraps `useContext`, so it must be called unconditionally at the top of
the component. That registers the fiber as an auth consumer permanently — for
every policy, regardless of status. Flipping the role switcher in the header then
re-renders every mounted `PolicySummaryCard`, including all the `active` ones,
which never render the reinstatement note that the role actually affects.

`use()` is not a hook and has no fixed call order to preserve. Called inside `if
(policy.status === 'lapsed' || policy.status === 'cancelled')`, it registers the
dependency only on renders that take the branch. An active policy's card is not
an auth consumer, and a role switch does not touch it.

The rule `use()` still obeys, which is the follow-up: it must be called from a
component or hook during render, and never after the component has returned.
Conditional is fine; asynchronous is not.
</details>

<details>
<summary><b>10.4</b> — Every serious app uses TanStack Query for this. Your promise cache has no invalidation, no staleness, no refetch-on-focus, no deduplication window, no garbage collection. Why is it here?</summary>

It is here because CLAUDE.md forbids data libraries, and the reason that rule
exists is that hand-rolling this cache is what makes the mechanism visible.

But the honest answer to "why is it here" as an engineering question is: it
should not be, in a real product. The list is accurate and incomplete —
`policyResourceCache` also never evicts, so a long session monotonically retains
every policy detail the user has opened, and `clearPolicyResource` is called only
from a Retry handler. There is no TTL, no background revalidation, and no way to
know a cached policy is stale after someone else edits it.

What the hand-rolled version demonstrates that a library would hide: *why* the
cache is load-bearing rather than an optimisation. With TanStack Query, `use()`'s
infinite-suspend loop (10.2) never happens and the reason it never happens is
buried in the library. Here it is four lines in `api.ts` and one paragraph in a
header, and the failure is one deletion away from being reproducible.

The right framing: this is a teaching implementation of the specific guarantee
`use()` requires — promise identity stability — not a cache.
</details>

<details>
<summary><b>10.5</b> — <code>getPolicyResource</code> caches rejections. That means one transient network blip poisons a policy for the entire session. Defend that.</summary>

It is not defensible as product behaviour, and the app compensates rather than
fixes.

The compensation is `clearPolicyResource`, wired to `ErrorBoundary`'s `onRetry`
in both `PolicyDetailPage` and `RiskExposurePanel`, so the user has an explicit
way out. That is why the ordering in `handleRetry` matters (7.2) — evict, then
remount.

Why it is cached at all: `use()` needs one stable promise per key, and a promise
is a single settled value. "Cache fulfilments but not rejections" means the Map
must hold something that is not the promise — a state machine around it — at which
point you have started writing TanStack Query (10.4).

The production shape is to catch the rejection at the cache layer, evict the entry
in a `.catch`, and let the next render create a fresh promise — self-healing
without a button. That has its own failure mode, a render loop against an endpoint
that is down for good, which is precisely the `risk-feed-outage` scenario. Which
is why the explicit Retry is the version here: it fails in a way the user can see
and act on, rather than in a way that spins.
</details>

---

## 11. `useDeferredValue` vs `useTransition` vs debounce

<details>
<summary><b>11.1</b> — All three are on <code>/policies</code> at once. That looks like collecting hooks. Give the one-line division of labour.</summary>

Different owners, different questions.

- **`useDebounce`** — *"has the user stopped?"* Owns the URL write. Time-based,
  and time is the only thing that can answer it. Nothing else knows the
  difference between a pause and a gap between keystrokes.
- **`useDeferredValue`** — *"this value's source is urgent; the work downstream
  of it is not."* Applied to `rawQuery`, which arrives from a controlled input
  that must echo characters immediately. The component does not own the source,
  so it defers the *value*.
- **`useTransition`** — *"this state update I own is not urgent."* Applied to
  `setView` on the tab switch. The component owns the update, so it classifies
  the update.

The last two are the same priority idea entered from opposite ends. The tab click
is ours to classify, so `useTransition` is right there; a deferred `view` value
would leave `setView` itself urgent and fix nothing. The query text is not ours
to classify, so `useDeferredValue` is right there.
</details>

<details>
<summary><b>11.2</b> — <code>useDeferredValue</code> made the debounce redundant. Delete it.</summary>

They defend different things, and deleting the debounce breaks something the
deferred value never touched.

`useDeferredValue` keeps the *render* off the critical path — React paints the
keystroke, then re-filters at lower priority. It does not delay anything by a
fixed time and does not know or care about typing rhythm.

The debounce guards the *URL*. Without it, `setSearchParams` fires on every
keystroke. Each call replaces the history entry, so a link copied mid-type reads
`?q=acc` instead of `?q=accident%20claim`. `useDeferredValue` would not help,
because the deferred render still happens on every keystroke — just later.

Filter: deferred. Side effect with an externally-visible artefact: debounced.
</details>

<details>
<summary><b>11.3</b> — The debounced URL commit is wrapped in a standalone <code>startTransition</code> inside an effect. Why not <code>useTransition</code>, and why any transition at all for one <code>setSearchParams</code>?</summary>

`useTransition` returns `isPending`, and there is nothing here to show it on. The
commit fires from an effect after a timer, not from a control the user is looking
at — a spinner attached to it would flash 300ms after typing stopped, attached to
nothing the user did. `startTransition` standalone is the same scheduling with no
pending flag to wire up.

Why any transition: `setSearchParams` triggers a router state update, which
re-renders everything under `<Routes>`. Firing that as an urgent update from a
timer means it can land in the middle of a keystroke's render and starve it —
React must finish urgent work before painting, and this update arrives with no
relationship to what the user is currently doing. Marking it non-urgent lets a
keystroke pre-empt it.

The general form: an update that originates from a timer rather than from an
interaction has no claim to urgency, because there is no interaction waiting on it.
</details>

<details>
<summary><b>11.4</b> — Why does <code>useTransition</code> need the "Switching…" strip? Isn't a transition supposed to make things feel faster?</summary>

A transition deliberately keeps the *old* view on screen while the new one renders
in the background. From the user's side, clicking "Exposure by customer" and
seeing the policy table stay exactly as it was is indistinguishable from the click
not registering.

So without something on screen admitting the staleness, the transition makes the
app feel *broken* rather than smooth — the user clicks again, and now two
transitions are in flight.

That is why `useTransition` returns `isPending` alongside `startTransition` in the
first place: keeping stale content visible is only an improvement if something
says it is stale. The correct fix when a transition feels unresponsive is not to
remove the transition, it is to render the flag it already handed you.
`PolicyBookTabs` is the component that exists to do that and nothing else.
</details>

<details>
<summary><b>11.5</b> — What does the tab switch actually cost, and how would you know if <code>useTransition</code> were unnecessary?</summary>

It unmounts up to 140 memoised `PolicyRow`s and mounts a fresh aggregate table —
a genuinely different subtree, not a re-sort. Urgent means React may not paint
until that completes, so anything the user does during it waits, including a
keystroke in the search box directly above.

That is the observable test: type while the switch is in flight. Without the
transition the character appears late, in a burst, after the new table renders.
The input is controlled, so the delay is in echoing a character the user has
already typed — the most visible possible latency.

If that test showed nothing, the transition would be unjustified and should go.
`ExposureByCustomer` exists precisely so it shows something —
`ExposureByCustomer.tsx`'s header says so directly: "a transition is only
defensible if the render it defers is big enough to drop a frame, and 're-render
the same table with the rows in a different order' is not."
</details>

---

## 12. `useSyncExternalStore`

<details>
<summary><b>12.1</b> — <code>useState(navigator.onLine)</code> plus a <code>useEffect</code> with two listeners is five lines and everyone understands it. Why the exotic hook?</summary>

Because the five-line version has a tearing window that only shows up under
concurrent rendering.

The `useState` mirror is updated by an effect, which runs after commit. Between
the store changing and that effect landing, a concurrent render that reads
`navigator.onLine` directly and one that reads the mirror can disagree — and
React 19 is allowed to interrupt and resume renders, so "both halves of one paint
saw the same value" is not free.

`useSyncExternalStore` is the mechanism that makes "the value this component
rendered with" and "the value the store currently holds" the same guarantee React
gives `useState` itself, for a store React does not own. It re-reads the snapshot
during render and forces a synchronous re-render if it changed mid-flight.

Secondary, and easier to demonstrate: it collapses the subscribe/unsubscribe
boilerplate into a `subscribe` function React owns, so there is no way to
mismatch add and remove.
</details>

<details>
<summary><b>12.2</b> — <code>getServerSnapshot</code> returns <code>true</code>. This app never server-renders. Dead code?</summary>

Not dead — the parameter is not optional in practice.

React always asks for a server snapshot up front to decide whether client and
server agree during hydration. Omitting it and hydrating throws, and the throw
happens during the hydration check rather than during the first `getSnapshot`
call, so the error points somewhere unhelpful.

`navigator` does not exist on the server, so `getSnapshot` itself would throw
there regardless.

The interesting part is the *value*: `true`, meaning "assume online". `false`
would render the offline banner into the server HTML for every visitor and then
remove it on hydration — a flash of an alarming message caused entirely by a
default. When the client value is unknowable server-side, the right default is
the one whose UI is empty.
</details>

<details>
<summary><b>12.3</b> — <code>subscribe</code> and <code>getSnapshot</code> are module-level functions. What happens if you inline them into the hook body?</summary>

An infinite resubscribe loop, or close to it.

`useSyncExternalStore` re-subscribes whenever `subscribe`'s identity changes.
Defined inside the hook, it is a new function every render: React unsubscribes and
resubscribes on every render, and since resubscribing can trigger a re-render, the
loop can sustain itself.

`getSnapshot` fails differently and worse. It must return a value that is
`Object.is`-equal when nothing changed. A fresh identity is fine for a primitive
`boolean`, but the moment a snapshot returns an object — `{ online, since }` —
a per-render `getSnapshot` returns a new object every call, React concludes the
store changed on every render, and React throws "The result of getSnapshot should
be cached to avoid an infinite loop".

Module scope makes both stable for free. The general rule: `useSyncExternalStore`'s
three arguments must be referentially stable, and the cheapest way to guarantee
that is to define them where re-rendering cannot reach them.
</details>

<details>
<summary><b>12.4</b> — <code>src/shared/labs/registry.ts</code> is a plain module store with a subscribe/notify pair — a textbook <code>useSyncExternalStore</code> candidate — and <code>useLabFlag</code> bridges it with <code>useState</code> + <code>useEffect</code> instead. That is the exact anti-pattern you just argued against. Explain yourself.</summary>

Correct, and it is deliberate rather than overlooked — though the reasoning is
worth stating precisely, because "we chose not to" is only a defence if the choice
was real.

The reasons, in order of weight:

1. **A second claim on the row is not a stronger claim.** C-04's named feature is
   the connectivity banner, and `useOnlineStatus` builds it honestly. Rewriting
   `useLabFlag` as well would be a redundant second demonstration of the same
   hook, not a better one.
2. **It is load-bearing infrastructure.** Six lab defects and the C-05 toggle
   depend on `useLabFlag`. Rewriting working infrastructure for the matrix's
   benefit rather than the app's is the thing CLAUDE.md rules out.
3. **The tearing risk is nil here.** The flags are dev-only, flipped by a human
   clicking a checkbox, read by components that re-render on the same click.
   There is no concurrent-render window for the two values to disagree in.

Where the criticism lands: reason 3 is the only *technical* one, and it is an
argument that the anti-pattern is harmless here — not that it is right. If
`useLabFlag` were shipped code rather than dev tooling, the correct answer would
be to rewrite it. `useLabFlag`'s own header says this, and points at the matrix
row.
</details>

<details>
<summary><b>12.5</b> — How would you prove the subscription actually works, rather than the banner just reflecting the value read at mount?</summary>

Toggle offline in DevTools' Network panel with the app already open and idle. The
banner appears without a reload and without any interaction — which it cannot do
from a mount-time read.

The negative control matters as much: the banner must also *disappear* when
connectivity returns, which proves `subscribe` registered the `online` event and
not just `offline`. A hook that only listened for `offline` would pass the first
test and fail this one, and "appears but never leaves" is exactly the bug a
one-direction subscription produces.

The unit-test form: dispatch `new Event('offline')` on `window` and assert the
banner renders, then dispatch `online` and assert it unmounts. No such test exists
today — that is a real gap, and it is the cheapest test in this list to write.
</details>

---

## 13. `useOptimistic` rollback

<details>
<summary><b>13.1</b> — Where is the code that removes the optimistic row when the submit fails?</summary>

There isn't any, and that is the point rather than an omission.

`useOptimistic` derives its overlay from `claims`, which is
`[...fetchedClaims, ...appended]`. The optimistic entry exists only for the
duration of the action. React drops it when the action's transition finishes and
reverts to the underlying state.

On success, `setAppended` runs, so `claims` has genuinely grown and the row the
user was already looking at is now backed by real data — it does not flicker,
because the optimistic row is replaced by an equivalent real one in the same
position.

On failure, the `catch` block calls `setAppended` never. `claims` never grew. When
the action finishes, React reverts to `claims` and the row simply is not there.

The alternative — a plain `appended` array plus manual removal — needs bookkeeping
to remove exactly the entry that failed out of however many are in flight, which
is a correctness problem that scales with concurrency. Here there is no removal
step to get wrong.
</details>

<details>
<summary><b>13.2</b> — <code>useOptimistic</code> only applies inside a transition. <code>handleLogClaim</code> is a plain <code>async function</code>. Why does it work?</summary>

Because of where it is called from, not what it is.

`ClaimForm` renders `<form action={formAction}>` where `formAction` comes from
`useActionState`. React runs form actions inside a transition, and
`handleLogClaim` is awaited from inside that action — so `addOptimisticClaim` is
called within the transition scope and the optimistic update applies.

The failure mode to be ready for: call `handleLogClaim` from a plain `onClick`
instead, and `addOptimisticClaim` fires outside any transition. React 19 warns
("An optimistic state update occurred outside a transition or action") and the
update is dropped — silently, as far as the UI is concerned. The row never
appears, the submit still works, and the bug looks like `useOptimistic` being
broken rather than like a missing transition.

This is why the migration from `onClick` + `useState` to `<form action>` was not
cosmetic: the action is what supplies the scope the optimistic update needs.
</details>

<details>
<summary><b>13.3</b> — <code>handleLogClaim</code> closes the modal on its first line, before <code>await</code>. What does that do to <code>SubmitButton</code>'s <code>useFormStatus</code>?</summary>

**⚠ WEAK SPOT.** It makes it unobservable on this form.

`modalRef.current?.close()` sets `isOpen` false, `Modal` returns `null`, and the
entire `<form>` — `SubmitButton`, `FormCancelButton`, both `TextField`s —
unmounts. The action continues (it is a promise, not tied to the component), and
`useOptimistic` is fine because it lives in `PolicyClaimsTab`, which stays
mounted. But nothing is left to render `pending`, so the "Submitting…" label and
the disabled Cancel button never appear here.

C-07's claim of two working call sites is therefore one-and-a-half.
`ClaimIntakeWizard` is the real one: `ClaimIntakePage.handleSubmit` awaits
`submitClaim` *before* closing the modal, so the wizard stays mounted for the full
400–900ms round trip and the pending state is visible.

The fix is not to reorder — closing immediately is the correct UX here, because
the optimistic row in the table below is the feedback and a modal lingering on top
of it would obscure the thing it is meant to reveal. The fix is to stop claiming
this form as a `useFormStatus` demonstration, or to keep the modal open until the
action settles and drop the optimistic row's job to the table alone. The two
features are in genuine tension and the file does not currently acknowledge it.
</details>

<details>
<summary><b>13.4</b> — Optimistic UI lies to the user. On the failure path they see a claim appear and then vanish, possibly having already navigated away believing it filed. Why is that better than a spinner?</summary>

It is better only because the failure is loud, and the honest answer has to lead
with what makes it loud.

The case for: the round trip is 400–900ms. With a spinner, nothing distinguishes
"the click registered and is in flight" from "the click did nothing" for most of a
second — long enough that a real agent's instinct is to click "Log claim" again,
which files a duplicate. The optimistic row makes the pending state concrete and
positioned exactly where the result will be.

What makes the lie acceptable: the row is labelled "Submitting…" rather than
rendered as a confirmed claim, and the failure path fires a `Toast` naming the
rejection. The row vanishing on its own would be indefensible; the row vanishing
alongside an explicit "Claim submission failed: …" is a state the user can act on.

Where it is genuinely weak, and worth conceding: the toast auto-dismisses after
4 seconds (and see 2.3 — that timer is fragile), and there is no persistent record
of the failed attempt. An agent who looked away loses it entirely. A real
implementation keeps failed submissions in the table in an error state until
dismissed, rather than reverting them.

The rule: optimistic updates are for operations that almost always succeed and
whose failure is *recoverable and visible*. A claim submission that can be
retried qualifies. An irreversible payment does not.
</details>

<details>
<summary><b>13.5</b> — <code>useOptimistic</code> is React 19-only. The same behaviour is a <code>useState</code> array and two lines in the <code>catch</code>. Why take the dependency?</summary>

Because the two lines in the `catch` are two lines *per failure path*, and they
have to identify the right entry.

The manual version appends a pending claim to local state, then on failure removes
"the one that failed" — which needs an id generated client-side, matched, and
filtered out. That is tractable with one submission in flight. With two, the
filter has to be exact, and any path that forgets to remove — an early return, a
thrown error inside the `catch`, a component unmount mid-flight — leaves a ghost
row in the table permanently, showing a claim that does not exist.

`useOptimistic` removes the removal. The overlay is *derived* from the real state,
so there is no entry to track and no cleanup to forget. Failure paths cannot leak,
because reverting is the default rather than a step.

The honest concession: on this form, with one submission at a time and a modal
that closes on submit, the manual version would work and would be maybe six lines
longer. The dependency pays off at concurrency, and this app does not have much.
What it does have is a correctness *shape* that cannot regress, which is worth more
than six lines on code someone else will edit.
</details>

---

## Cross-cutting: the questions that do not fit one section

<details>
<summary><b>X.1</b> — Every memoised component logs on render, and CLAUDE.md forbids removing those logs. What do they cost?</summary>

In the browser, effectively nothing — 280 `console.log` calls on a page mount are
invisible next to the 30ms `rateBook`.

In tests they were the second-largest term in a flaky timeout: `App.test.tsx`'s
`/policies` walk emits ~280 log lines that Vitest funnels through its reporter,
adding roughly 350ms to a mount that was already racing a 1000ms default timeout.
Silencing them was measured at ~300ms of the ~1.2s — real, but not the dominant
term, which was the on-demand module transform of the lazy chunk (~600ms).

So they were kept, the budget was made explicit instead, and the measurement is
recorded in `App.test.tsx`'s header. The general point: instrumentation that is
free in production can be the difference between a green and a red test, and the
right response is to size the test's budget honestly rather than to delete the
instrumentation or to nudge the timeout until it passes.
</details>

<details>
<summary><b>X.2</b> — <code>RequireRole</code> redirects from inside a <code>useEffect</code> and returns <code>null</code> in the meantime. Why not <code>&lt;Navigate to="/" replace /&gt;</code>?</summary>

**⚠ WEAK SPOT.** `<Navigate>` is the better answer and the file does not defend
the choice it made.

`<Navigate>` is declarative, redirects during the render pass rather than after
commit, and does not require the component to render `null` first. The effect
version commits an empty render, then navigates — a wasted commit, and on a slow
frame a visible blank flash where the protected route would have been.

The effect version also has a subtle dependency hazard: `[allowed,
location.pathname, navigate]`. If `navigate`'s identity ever churned — it does not
in `react-router-dom` 6.26, but it is not a documented guarantee — the effect
would re-fire and re-navigate.

What the current form gets right is the payload: `state: { attemptedPath:
location.pathname }`, which `DashboardPage` reads to explain the redirect rather
than dumping the user somewhere with no context. `<Navigate>` supports `state`
identically, so nothing is lost by switching.

The correct answer under questioning is to concede and name the rewrite, not to
construct a reason for the effect after the fact.
</details>

<details>
<summary><b>X.3</b> — <code>ClaimIntakeWizard</code>'s <code>&lt;form&gt;</code> wraps only the navigation buttons. None of the fields are inside it, and the action ignores its <code>FormData</code>. Is that a form?</summary>

Barely, and the file admits half of it.

The admitted half: `formData` goes unused because the values already live in this
component's controlled state, and re-deriving them from `FormData` would be a
second source of truth for the same three fields.

The unadmitted half is the shape. A `<form>` that contains no inputs exists purely
to host `useActionState` and `useFormStatus`, both of which need a form ancestor.
That is the API's constraint being satisfied rather than a form being modelled —
and it means the wizard gets none of what a real form provides: no native
validation, no Enter-to-submit from a field, no `FormData` serialisation, nothing
that works with JavaScript disabled.

`PolicyClaimsTab`'s `ClaimForm` is the honest counterexample: fields inside the
form, action reads `FormData`, per-field errors returned from the action. That is
why two call sites exist rather than one — though see 13.3 for the other thing
wrong with that one.

The defensible position: the wizard's three steps genuinely cannot share one
`<form>` without either mounting hidden inputs for the inactive steps or losing
state between them, and the controlled-state design is the right one for a step
machine. What follows from that is that the wizard is not the place to
demonstrate form actions — not that a button-only `<form>` is a good shape.
</details>

<details>
<summary><b>X.4</b> — Pick the single weakest claim in <code>docs/coverage-matrix.md</code> and argue against yourself.</summary>

W3-D1-02, `React.memo` with a custom comparator (`PremiumBadge`). It is now
marked `[~]`, and the reason it is the *weakest* rather than merely qualified is
worth separating from the reason it is wrong.

The row satisfied every criterion the matrix stated: the file exists, the export
is real, it is reachable from `/policies`. And the comparator never executes,
because its parent is memoised on stable props and a bailed-out parent never
renders its child. The repo's own measurement says so (`docs/render-counts.md`),
and if it did execute it would cost two `Intl` format calls to skip a render
costing one.

That combination — reachable, correct, present, and inert — is the most dangerous
kind of coverage claim, because every mechanical check passes. It is a stronger
finding against the *matrix's criteria* than against the code: "names a real
file, a real export, and a route the agent can click to" is not sufficient. That
gap is why the matrix now has a `[~]` marker at all, and why its criteria were
rewritten to ask whether the mechanism can be observed doing something.

Runners-up among the qualified rows: W2-D2-06 (split context with no
dispatch-only consumer, and no memo on the steps that would make it pay off),
W3-D1-04 (a context-value memo whose bail-out branch is unreachable), C-07 (real
in the wizard, unmounted before it can render in the claims form), and W2-D1-01
(mount-only fetch, which the codebase argues its way out of rather than
demonstrating).

**The one that is no longer on this list**, and the more instructive story:
W3-D4-02's `React.lazy` half was not inert, it was *false* — the header asserted
a recovery that a probe disproved in three lines of output. Inert claims can be
documented; false ones have to be fixed or retracted. It was fixed (see 7.3), so
it is back to `[x]` with a test behind it. The distinction is the useful one to
carry into the review: **"correct but does nothing here" is a footnote; "says it
does something it does not" is a defect.**
</details>
