# Authentication setup

HomeBuild uses [Firebase Authentication](https://firebase.google.com/docs/auth)
for email/password sign-in, Google and Apple OAuth, email verification, and
password recovery.

The application code is complete. What follows is the console configuration it
depends on — without it, sign-in fails with `auth/unauthorized-domain` or
`auth/operation-not-allowed` even though nothing is wrong with the build.

---

## 1. Credentials

Create a project at [console.firebase.google.com](https://console.firebase.google.com),
add a **Web app** to it, then copy the config object from
**Project settings → General → Your apps → SDK setup and configuration**.

```bash
cp .env.example .env.local
# fill in all six values, then restart the dev server
npm run dev
```

These values are public. Vite inlines them into the client bundle, and a
Firebase web API key **identifies** the project rather than authorising
anything — it is not a secret and Google documents it as safe to expose. What
protects your data is the **Authorized domains** list plus Security Rules.
Never put a service-account key in a `VITE_` variable.

Until `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`,
`VITE_FIREBASE_PROJECT_ID` and `VITE_FIREBASE_APP_ID` are all present, the app
renders a setup screen naming what is missing instead of failing at the first
click.

### On Vercel

Add the same six variables under **Project Settings → Environment Variables**
for Production, Preview and Development, then redeploy. Vite reads env vars at
**build** time, so changing them requires a new build — not just a restart.

---

## 2. Enable the sign-in methods

**Authentication → Sign-in method.** Enable:

- **Email/Password** — leave "Email link (passwordless)" off; this app uses
  passwords.
- **Google** — set a project support email and save. Firebase provisions the
  OAuth client for you, so there is nothing to do in Google Cloud Console.
- **Apple** — off by default in this app; see section 4.

A method left disabled fails at runtime with `auth/operation-not-allowed`.

---

## 3. Authorized domains

**Authentication → Settings → Authorized domains.**

`localhost` is there by default. Add every domain the app is served from:

```
your-project.web.app          (added automatically)
your-project.firebaseapp.com  (added automatically)
your-domain.com
your-project.vercel.app
```

> **Firebase does not support wildcards here.** This is a real operational
> difference from other providers: Vercel generates a unique URL for every
> preview deployment (`your-project-git-branch-team.vercel.app`), and each one
> is a distinct domain that OAuth will reject with `auth/unauthorized-domain`.
>
> Practical options: assign a **stable preview domain** in Vercel and authorise
> that one; add specific branch domains as you need them; or accept that OAuth
> only works on production and localhost, where email/password still works
> everywhere.

---

## 4. Apple (optional, off by default)

**The Apple button is hidden unless you turn it on.** Enabling the Apple
provider in the Firebase console is not sufficient on its own: the web flow
needs the OAuth code-flow fields below, all of which require a **paid Apple
Developer account** ($99/year). A button that renders before that is configured
is a button that always fails, so the app ships with it off.

To enable it, complete the four steps below, then set:

```bash
VITE_ENABLE_APPLE_SIGNIN=true
```

in `.env.local` (and in Vercel's environment variables), and rebuild. Nothing
in the source needs to change — the button, its handler and the provider are
all still there, just filtered out.

1. In the [Apple Developer portal](https://developer.apple.com/account), create
   an **App ID**, then a **Services ID**. The Services ID acts as your OAuth
   client ID.
2. Configure the Services ID with your domain, and add Firebase's handler as
   the return URL — Firebase shows it on the Apple provider page, in the form
   `https://<project-id>.firebaseapp.com/__/auth/handler`. This is Firebase's
   URL, **not** your app's.
3. Create a **Sign in with Apple key** (`.p8`) and note the Key ID and Team ID.
4. Enter the Services ID, Team ID, Key ID and `.p8` contents into
   **Authentication → Sign-in method → Apple**.

Apple only returns the user's name on the **very first** authorisation, and only
if the user permits it. `toProfile` in `AuthContext.jsx` falls back to the email
local-part, and the UI renders initials when there is no name or picture, so an
Apple account that shares neither still looks correct.

---

## 5. Email templates and the action URL

**Authentication → Templates.**

By default, password-reset and verification links point at a Firebase-hosted
page that looks nothing like the product. To use the in-app screens, open any
template, click **Customise action URL**, and set it to:

```
https://your-domain.com/auth/action
```

Firebase appends `?mode=<action>&oobCode=<code>` to that URL. `/auth/action`
reads the mode and dispatches: password resets go to `/reset-password`, while
verification and email-recovery codes are redeemed in place.

Two things to know:

- **The action URL is a single global value.** It cannot vary per environment,
  so emails triggered from a local or preview build will still link to whatever
  domain you set here. For local testing of a reset link, copy the `oobCode`
  out of the emailed URL and open
  `http://localhost:5173/reset-password?oobCode=<code>` by hand.
- **Leaving it unset is a valid choice.** Firebase's own page works fine; you
  simply lose the branded screens. Nothing else breaks.

`vercel.json` rewrites all non-`/api` paths to `index.html`, so `/auth/action`
resolves on a cold load rather than 404ing at the edge.

---

## 6. Behaviour worth deciding on

**Email verification is not enforced.** Firebase signs a new user in
immediately, verified or not, and this app keeps that behaviour: sign-up sends
a verification email and lets the user in. Settings shows their status with a
**Resend email** action.

To require verification before granting access, add a check in
`src/router/ProtectedRoute.jsx` against `user.emailVerified` and route
unverified users to a holding screen. That is a product decision, so it is not
baked in.

**Minimum password length is 6**, enforced by Firebase and stated by the sign-up
and reset forms. If you enable Firebase's stronger password policy, update
`MIN_PASSWORD` in `src/pages/SignUp.jsx` and `src/pages/ResetPassword.jsx` so
the client-side message stays truthful.

**Popup vs redirect.** OAuth uses `signInWithPopup`, falling back to
`signInWithRedirect` when the popup is blocked or unsupported. Be aware that
redirect-based sign-in is unreliable in browsers that block third-party cookies
(Safari, Chrome incognito) when using the default `*.firebaseapp.com`
`authDomain`. If you hit this, the documented fix is to serve the auth handler
from your own domain — see Firebase's guide on
[redirect best practices](https://firebase.google.com/docs/auth/web/redirect-best-practices).

---

## 7. Turning providers on and off

Both OAuth buttons are controlled by env flags, so this is a configuration
change rather than a code change:

| Variable | Default | Effect |
|---|---|---|
| `VITE_ENABLE_GOOGLE_SIGNIN` | on | Set `false` to hide the Google button |
| `VITE_ENABLE_APPLE_SIGNIN` | off | Set `true` once Apple is configured |

The buttons are filtered, not deleted — `providerEnabled` in
`src/lib/firebase.js` is the single source of truth, and
`OAuthButtons.jsx` renders whatever survives it.

The layout adapts on its own: two providers sit side by side with short labels,
a single provider becomes one full-width "Continue with …" button, and if both
are disabled the button row **and** the "or continue with email" divider
disappear together, leaving a clean email-only form.

Remember to set the same flags in Vercel's environment variables — Vite inlines
them at build time, so a flag that only exists locally will not affect the
deployed site.

---

## How the app uses all this

| Concern | Where |
|---|---|
| App/auth init, providers, persistence | `src/lib/firebase.js` |
| Session state machine, all auth actions | `src/context/AuthContext.jsx` |
| Route guarding, redirect-back on sign-in | `src/router/ProtectedRoute.jsx` |
| Keeping signed-in users off auth screens | `src/layouts/AuthLayout.jsx` |
| Email action links (reset / verify / recover) | `src/pages/AuthAction.jsx` |
| Reset form, `oobCode` verify and redeem | `src/pages/ResetPassword.jsx` |

### Session behaviour

- Persistence is `browserLocalPersistence`, so a session survives reloads and
  is shared across tabs of the same origin.
- Firebase refreshes ID tokens automatically.
- `onAuthStateChanged` fires in **other tabs** too, so signing out in one tab
  signs out the rest.
- Route guards hold on a `loading` state until Firebase reports the persisted
  user. This is deliberate: treating that first async tick as "signed out" is
  what makes an app bounce a signed-in user to the login screen on every
  refresh.
- There is **no OAuth callback route**. Popup sign-in never leaves the page,
  and the redirect fallback returns to whichever screen started it.
- Password resets create **no session**. The link carries a one-time `oobCode`,
  verified on mount and redeemed on submit, so a reset works in any browser —
  not only the one that requested it.

### What is still fixture data

Authentication is real. Everything behind it is not — projects, invoices,
schedules, contractors and alerts are all compiled-in fixtures. The Settings
screen shows a real name, email, provider and verification status, but `role`,
`phone`, "Active Projects" and "Teams Led" come from `demoProfile` in
`src/data/user.js`, because there is no database behind them yet.
