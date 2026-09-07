# AEGIS — Break Drills

Deliberate sabotage, one drill at a time. Each drill names **one edit**, asks
for a **prediction before you make it**, and then records **what actually
happens**. Write the prediction down first; a prediction read after the answer
is not a prediction.

The point is not that the app breaks. The point is *how*. Most of these fail
silently, or fail three files away from the edit, or keep passing every test in
the suite — which is the honest reason each mechanism exists, stated in the form
a reviewer can check.

**Format:** `Break` → `Predict` → `Actually`. Revert after every drill; several
of them leave the app in a state where the next drill's result is not what it
looks like.

> This file is new as of Week 4 Day 5 and starts at Week 4. `docs/qa-drills.md`
> is the Week 1–3 counterpart in a different shape — hostile questions with
> collapsed answers — and `docs/failure-modes.md` is the one-row-per-concept
> table. This file is the one you run with the dev server open.

---

## Week 4 — MUI, theming, axios, Redux Toolkit, react-hook-form

### D1 — Move `ThemeModeProvider` inside `BrowserRouter`

**Break.** In `src/main.tsx`, swap the nesting so `<BrowserRouter>` wraps
`<ThemeModeProvider>` instead of the other way round.

**Predict.** Nothing? A provider is a provider, and every route is still below
it.

**Actually.** The app renders and looks correct, which is the problem. Two
things are now wrong and neither shows on first paint. The theme object is
recreated whenever the Router re-renders its subtree for a navigation, so
`ThemeProvider` — which compares by identity — hands every `styled()` component
and every `sx` prop in the app a fresh theme on route change, re-serialising
Emotion's styles. And `CssBaseline`'s `body` rule is now written by a component
that unmounts and remounts across navigations. The visible tell is subtle:
switch to dark, navigate between `/dashboard` and `/policies` a few times, and
watch the paint. `W4-D1-01`.

---

### D2 — Delete the `body1` override from `createAegisTheme`

**Break.** Remove the `typography.body1` block in `src/shared/theme/theme.ts`.

**Predict.** MUI surfaces get slightly larger body text. The CSS Modules routes
are untouched, because they do not read the theme.

**Actually.** **Every route changes size, `/policies` included.** `CssBaseline`
spreads `typography.body1` onto `body`, and its injected sheet lands *after*
`global.css` — so MUI's default `1rem` becomes the base font size for the whole
document, and the CSS Modules routes inherit it. This is the one theme override
in the file that is not house style; it is there because the alternative is a
styling system silently reaching across the boundary it is supposed to respect.
`W4-D2-02`.

---

### D3 — Drop `shouldForwardProp` from `StatusChip`

**Break.** In `src/shared/theme/StatusChip.tsx`, delete the
`{ shouldForwardProp: (prop) => prop !== 'status' }` options object.

**Predict.** React warns about an unknown DOM attribute in the console.

**Actually.** **Silence.** React only warns about unknown attributes that look
like camelCase React props; a lowercase `status` is a valid custom attribute as
far as it is concerned, so every badge in the app renders as
`<div class="…" status="lapsed">` with nothing said. The chip still looks
correct. The failure is deferred to whoever later writes a `[status]` attribute
selector, or ships this to a browser that starts treating the attribute as
meaningful. `W4-D2-04`.

---

### D4 — Make the theme toggle two-state

**Break.** In `src/shared/layout/AppShell.tsx`, change the toggle so it flips
between `'light'` and `'dark'` only, dropping `'system'` from the cycle.

**Predict.** Fine — nobody uses "system", and two states are easier to explain.

**Actually.** The first click is a one-way door. `'system'` is the only choice
that keeps the `matchMedia` subscription alive, so once a user has pressed the
button they can never get back to "follow my OS" without clearing
`localStorage`. Nothing on screen says so, and the bug is only observable by
changing the OS theme afterwards and watching the app not follow. `W4-D2-03`.

---

### D5 — Stub the endpoint functions instead of the adapter

**Break.** In `src/shared/http/endpoints.ts`, replace
`fetchUnderwritingLimits`'s body with
`return Promise.resolve({ autoBindLimit: 2_500_000, maxLoadingPct: 40, referralLossRatio: 0.7 })`.

**Predict.** `/underwriting` renders identically and one fewer request goes out.

**Actually.** It renders identically, which is exactly why this is the most
dangerous edit in the file. The page still works, the tests still pass — and
every claim this repo makes about interceptors is now false for that call. No
token is attached, nothing is logged, no correlation id is minted, the 401
refresh path cannot fire, and the `AbortSignal` is ignored. Mocking at the
*adapter* rather than at the endpoint is what keeps "every request goes through
every interceptor" a fact rather than an assertion. `W4-D3-01`.

---

### D6 — Remove the `/auth/*` skip from the request interceptor

**Break.** In `src/shared/http/interceptors.ts`, delete the branch in
interceptor (a) that returns early for `/auth/*` paths.

**Predict.** The login request gets a bearer token it does not need. Harmless.

**Actually.** The app hangs on its first request and never recovers. The
bootstrap in interceptor (a) awaits a login before letting a request through;
with the skip gone, the login *itself* enters that branch and awaits a login —
which is the promise it is already inside. Nothing rejects, nothing times out at
the interceptor level, and the console simply stops after one `[http] →`.
`W4-D3-02`.

---

### D7 — Turn `Promise.all` into three sequential awaits

**Break.** In `src/routes/UnderwritingPage.tsx`, replace the `Promise.all` with
`const policies = await fetchPolicies(signal);` and so on, one per line.

**Predict.** The page takes three times as long to load. Nothing else changes.

**Actually.** The page takes three times as long — *and* W4-D3-04 stops being
demonstrable, with nothing in the UI saying so. Arm `expire-token` and reload:
the first request 401s alone, refreshes, and succeeds; the second goes out
afterwards carrying the *new* token and never 401s at all. The single-flight
queue has nothing to collapse, so the mechanism the row is about never
executes. `src/routes/UnderwritingPage.test.tsx` catches this — it reads the
adapter's request log rather than the screen, because the screen is identical.
`W4-D3-04`.

---

### D8 — Make the `expire-token` lab toggle sticky

**Break.** In `src/shared/http/mockBackend.ts`, delete the
`setLabEnabled('expire-token', false)` line inside `unauthorized()`.

**Predict.** The toggle keeps expiring tokens until switched off manually,
which is a more thorough demo.

**Actually.** The demo now ends in a failure instead of a recovery, and it looks
like the refresh flow is broken. The replayed request presents its shiny new
token, the still-armed toggle revokes *that* one, the replay 401s again, finds
`_retry` already set, and is normalised into an error the user sees. Every part
of the refresh flow worked correctly; the toggle made the outcome unreadable.
One-shot is what turns this into a demonstration of recovery. `W4-D3-04`.

---

### D9 — Drop `config.signal` from an endpoint wrapper

**Break.** In `src/shared/http/endpoints.ts`, remove `{ signal }` from
`fetchPolicies`.

**Predict.** Aborting no longer cancels that request, so it completes in the
background and its result is thrown away. Wasteful, not wrong.

**Actually.** Correct as far as it goes, and it hides how thin the protection
is. `useFetch` still guards with `if (controller.signal.aborted) return`, so
nothing stale reaches the screen — but that is *one line in one hook* standing
between the user and another page's data. Add a second consumer that forgets
the guard and the stale response wins. Watch the console: the `[useFetch]
cleanup` line still prints, and `[http] ←` arrives after it with a 200.
`W4-D3-05`.

---

### D10 — Return a fresh object from `useAuth`

**Break.** In `src/shared/store/useAuth.ts`, replace the four separate
`useAppSelector` calls with one:
`useAppSelector((s) => ({ user: s.auth.user, role: s.auth.role, status: s.auth.status, error: s.auth.error }))`.

**Predict.** Tidier. One subscription instead of four.

**Actually.** Every component calling `useAuth()` re-renders after *every*
dispatched action in the app — including `claims/submit/pending` and every
`auth/refresh/*` a 401 recovery fires — because the selector builds a new object
each run and `Object.is` can never match it. That is `AppShell`, `RequireRole`,
`PolicySummaryCard` and `UnderwritingPage`, four times per token refresh. React
19 will not warn; react-redux may log a "selector returned a different result"
warning in development, which is the only signal you get. `W4-D4-01`.

---

### D11 — Make `switchRole` genuinely mutate

**Break.** Immer makes this one hard to do by accident, which is the point —
assignments to `state` inside a `createSlice` reducer are recorded on a draft,
not applied. To get a real mutation you have to leave the draft: hoist a
module-level `let current = { ...initialState }` in
`src/shared/store/authSlice.ts`, and have `switchRole` write to `current` and
`return current`.

**Predict.** The state is right, so the UI updates.

**Actually.** The state is right and **nothing on screen moves**. Before and
after are the same reference, so every `Object.is` comparison answers
"unchanged": the AppBar's select stays on the old role, `RequireRole` goes on
gating against it, and an underwriter is still redirected away from
`/underwriting`. The bug is invisible in the reducer, invisible in the store,
and visible only on the screen — which is why `quoteReducer`'s registered
`mutating-reducer` defect exists one folder away in the opposite style.
`W4-D4-02`.

---

### D12 — Drop `pending` from `loginThunk`'s `extraReducers`

**Break.** Delete the `.addCase(loginThunk.pending, …)` block.

**Predict.** The role switcher stops greying out. Cosmetic.

**Actually.** The lock is not cosmetic: it is what stops a second role switch
being fired while the first is still in flight. Switch twice quickly and both
logins resolve; which token the store keeps is decided by whichever `fulfilled`
lands last. You can end up an underwriter in the UI holding an agent's token,
and the only evidence is the `at-N-agent` string in the console. `W4-D4-03`.

---

### D13 — Un-memoise `selectExposureByCustomer`

**Break.** In `src/shared/store/selectors.ts`, change `createSelector([...], fn)`
to a plain `export const selectExposureByCustomer = (state) => fn(selectUser(state))`.

**Predict.** Slower. Some wasted work per action.

**Actually.** Open `/underwriting` and count. `[compute] exposure roll-up` and
`[rating] rateBook 140 policies in …ms` print on *every dispatched action* —
including the three the page's own load fires (`auth/login/pending`,
`auth/login/fulfilled`, and each `claims/*` if you file one). That is ~350ms of
main thread each time, for a result that is byte-identical, and
`UnderwritingPage` re-renders both tables every time because the array identity
changed. `W4-D4-04`.

---

### D14 — Replace `Controller` with `register` on the policy `Autocomplete`

**Break.** In `src/routes/claimIntake/ClaimIntakeWizard.tsx`, swap the
`Controller`-wrapped `Autocomplete` for a `TextField` spread with
`{...register('policyId')}`.

**Predict.** It works, or it obviously does not.

**Actually.** It half-works, which is worse than either. The dropdown opens, the
option highlights, the selected policy appears in the box — and `policyId` in
the form's value store is whatever the user *typed*, because
`Autocomplete`'s ref points at the search input, not at the selected option.
Continue then reports "That policy number is not in the book" about a policy the
agent can see selected on screen. Nothing is logged. `W4-D5-01`.

---

### D15 — Drop the `path` from `claimSchema`'s `superRefine`

**Break.** In `src/routes/claimIntake/claimSchema.ts`, remove
`path: ['amount']` from the `ctx.addIssue` call.

**Predict.** The message moves somewhere less convenient. Still rejected.

**Actually.** The draft is still rejected — at the *final submit*, three
interactions later. The issue now lands at the form root, and
`trigger(STEP_FIELDS['Incident'])` matches issues by field path, so the step
gate sees nothing wrong and lets the agent through to Review. The amount field
never shows an error at all. `claimSchema.test.ts` catches this one, and it is
the reason that assertion checks the path rather than just `success === false`.
`W4-D5-02`.

---

### D16 — Hard-code the loading cap in `decisionSchema`

**Break.** Replace `makeDecisionSchema(maxLoadingPct)` with a module-level
`decisionSchema` using `.max(40)`.

**Predict.** Identical behaviour — 40 is what the underwriter's limits say
anyway.

**Actually.** Identical *today*. Switch the role, or change one number in
`mockBackend.ts`, and the form starts enforcing a rule the server does not have:
it accepts 40% where the server allows 10, and the underwriter is told about a
limit the screen never mentioned, by a 422, after submitting. The factory is not
ceremony — it is the only thing making the client's rule and the server's rule
the same rule. `W4-D5-02`.

---

### D17 — Remove `valueAsNumber` from the amount register

**Break.** Change `register('amount', { valueAsNumber: true })` to
`register('amount')`.

**Predict.** Zod coerces, or complains clearly.

**Actually.** Every submission fails with `Invalid input: expected number,
received string` on a field the agent filled in correctly. Zod does not coerce
unless asked, a DOM input's value is always a string, and the error is a
sentence about the resolver rather than about the claim. The tempting fix —
`z.coerce.number()` — makes it worse in a quieter way: `Number('')` is `0`, so
an *empty* amount box becomes a valid ₹0 claim. `W4-D5-01`.

---

### D18 — Disable Continue on `!isValid`

**Break.** In the wizard, change the Continue button to
`disabled={!isValid}`.

**Predict.** Better UX — you cannot advance with a bad form.

**Actually.** The agent is stuck with no way to find out why. `isValid`
reflects the *whole* schema, not the current step, so on step one it is false
because of every field on step two — Continue is dead before a single field on
the Incident step has been seen, and no error is shown because `trigger()` is
what surfaces the messages and it never runs. Pressing a live button and being
told what is wrong is the interaction; that is why `isValid` drives the button's
*variant* here and not its `disabled`. `W4-D5-03`.

---

### D19 — Drop `isDirty` from the submit guard

**Break.** Change `disabled={!isDirty || isSubmitting}` to
`disabled={isSubmitting}` in `DecisionForm`.

**Predict.** A user can submit an empty form and get a validation error. Mildly
annoying.

**Actually.** On the wizard, it means the Submit button is live on a form whose
only possible outcome is a failing request. On `DecisionForm` it is worse,
because `reset()` runs after a successful POST: without `isDirty` the button is
immediately live again on the freshly cleared form, and a second click files a
decision with a blank note against no policy — a real 422 for a request that
should never have been sendable. `W4-D5-03`.

---

### D20 — Remove `reset()` after a successful decision

**Break.** Delete the `reset({...})` call in `DecisionForm`'s `onValid`.

**Predict.** The fields keep their values. Convenient, if anything — the next
decision is probably similar.

**Actually.** The next decision inherits the previous one's *note*, and the
underwriting audit trail ends up saying the same sentence about four unrelated
risks. `isDirty` also stays true, so the submit guard is disarmed and the second
click re-files the first decision against whatever policy is now selected.
Convenience and correctness point in opposite directions here and correctness
wins. `W4-D5-03`.

---

### D21 — Give the `Dialog` `keepMounted`

**Break.** Add `keepMounted` to the `<Dialog>` in
`src/routes/ClaimIntakePage.tsx`.

**Predict.** The dialog opens faster. No downside.

**Actually.** The wizard chunk — 50 kB plus a shared 122 kB of Zod — is
downloaded and parsed on every visit to `/claims/new`, including by the majority
who read the page and leave. The dialog looks and behaves identically. This is
the same failure the app's own `Modal` was written to avoid, and
`src/App.test.tsx` is what catches it: it asserts the wizard's `<h2>` is *not*
in the DOM while the dialog is closed. `W3-D3-02`.

---

### D22 — Bring `useFormStatus` back into the wizard

**Break.** Put `SubmitButton` (which reads `useFormStatus()`) into the wizard's
`DialogActions` in place of the `isSubmitting` button.

**Predict.** It works — the buttons are descendants of the `<form>`, which is
the rule `SubmitButton`'s header states.

**Actually.** `pending` is `false` for the entire submit. Being a descendant is
necessary and not sufficient: `useFormStatus` reports on a React **form
action**, and this form is driven by `onSubmit={handleSubmit(...)}`, which is
not one. The button never shows its pending label, and a double-click files two
claims. This is the drill behind C-07's `[~]` in the matrix — the hook did not
lose its home to carelessness, it lost it to an incompatibility the curriculum
forces. `C-07`, `W4-D5-03`.

---

### D23 — Fold the `claims` slice into `auth`

**Break.** Move `submitted`, `status` and `error` from `claimsSlice` into
`AuthState` and delete the second reducer.

**Predict.** One fewer file. Both are session state anyway.

**Actually.** The next role switch wipes the agent's record of what they filed.
`logout` writes every field of `AuthState` out by hand — deliberately, so that
nothing survives a session ending — and a merged slice puts the filed-claims
list inside that blast radius. The failure needs two unrelated actions to
appear, which is why it is a slice boundary and not a comment. `W4-D4-01`.

---

### D24 — Read the role from a query parameter in `/underwriting/limits`

**Break.** In `src/shared/http/mockBackend.ts`, change the limits handler to
read `?role=` instead of parsing the presented bearer token.

**Predict.** Same numbers, simpler handler.

**Actually.** Same numbers, and the one place in the app where the request
interceptor's work is visible in a *response body* stops being that. It also
becomes an authorisation hole that reads as a convenience: any caller can ask
for an authority they do not hold by editing a URL, and the client is the only
thing deciding which role to request. `W4-D3-02`, `W4-D5-04`.

---

### D25 — Delete `src/routes/UnderwritingPage.test.tsx`

**Break.** Remove the file.

**Predict.** Coverage drops a little. The route is still exercised by
`App.test.tsx`.

**Actually.** It is not. `App.test.tsx` runs as the default `agent`, so its
`/underwriting` assertion is the *negative* one — that `RequireRole` turns the
agent away and the chunk never appears. Delete this file and the entire page can
stop rendering with a green suite: a route asserted only absent is a route
nobody tests. `W4-D5-04`.
