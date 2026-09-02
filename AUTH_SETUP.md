# Authentication setup

HomeBuild uses [Supabase Auth](https://supabase.com/docs/guides/auth) for
email/password sign-in, Google and Apple OAuth, and password recovery.

The application code is complete. What follows is the dashboard configuration
it depends on — without it, sign-in will fail with a redirect error even though
nothing is wrong with the build.

---

## 1. Credentials

Create a project at [supabase.com](https://supabase.com), then copy the project
URL and anon key from **Project Settings → API**.

```bash
cp .env.example .env.local
# fill in both values, then restart the dev server
npm run dev
```

Both values are public — Vite inlines them into the client bundle, and the anon
key is designed to ship to browsers. **Row Level Security is what protects your
data, not secrecy of this key.** Never put the `service_role` key in a `VITE_`
variable; it bypasses RLS entirely.

Until both variables are present the app renders a setup screen instead of the
auth forms, so a misconfigured deploy explains itself rather than failing at the
first click.

### On Vercel

Add the same two variables under **Project Settings → Environment Variables**
for Production, Preview and Development, then redeploy. Vite reads env vars at
**build** time, so changing them requires a new build — not just a restart.

---

## 2. Redirect URLs

**Authentication → URL Configuration.**

Set **Site URL** to your production origin, e.g. `https://homebuild.vercel.app`.

Add every origin the app runs on to **Redirect URLs**. Both paths are needed:
`/auth/callback` receives OAuth and email-confirmation returns, `/reset-password`
receives recovery links.

```
http://localhost:5173/auth/callback
http://localhost:5173/reset-password
https://your-domain.com/auth/callback
https://your-domain.com/reset-password
```

For Vercel preview deployments, add a wildcard so every branch URL works:

```
https://your-project-*.vercel.app/auth/callback
https://your-project-*.vercel.app/reset-password
```

> A redirect URL that is not on this list is silently rejected and the user
> lands on the "Sign-in didn't complete" screen. It is the single most common
> cause of OAuth failing in a new environment.

`vercel.json` already rewrites all non-`/api` paths to `index.html`, so these
deep links resolve on a cold load rather than 404ing at the edge.

---

## 3. Google

1. In [Google Cloud Console](https://console.cloud.google.com), create an
   **OAuth 2.0 Client ID** of type *Web application*.
2. Under **Authorised redirect URIs**, add the callback Supabase gives you on
   its Google provider page — it looks like
   `https://<project-ref>.supabase.co/auth/v1/callback`. This is Supabase's URL,
   **not** your app's.
3. Copy the client ID and secret into **Authentication → Providers → Google** in
   Supabase and enable it.

You will also need to complete the OAuth consent screen. While it is in
*Testing*, only accounts you add as test users can sign in.

---

## 4. Apple

Apple is more involved than Google and requires a **paid Apple Developer
account** ($99/year). If you want to ship sign-in before that is in place, hide
the Apple button — see step 6 below.

1. In the [Apple Developer portal](https://developer.apple.com/account), create
   an **App ID**, then a **Services ID** — the Services ID is what acts as your
   OAuth client ID.
2. Configure the Services ID with your domain and add Supabase's callback
   (`https://<project-ref>.supabase.co/auth/v1/callback`) as the return URL.
3. Create a **Sign in with Apple key** (`.p8`), and note the Key ID and your
   Team ID.
4. Enter the Services ID, Team ID, Key ID and the `.p8` contents into
   **Authentication → Providers → Apple** in Supabase.

Apple only returns the user's name on the **very first** authorisation, and only
if the user permits it. `toProfile` in `AuthContext.jsx` falls back to the email
local-part, and the UI renders initials when there is no name or picture, so an
Apple account without a shared name still looks correct.

---

## 5. Email

**Authentication → Email Templates.** The defaults work — they use
`{{ .ConfirmationURL }}`, which routes through Supabase's verify endpoint and
then to your redirect URL with a `code` parameter that the client exchanges.

Two settings worth deciding on deliberately, under **Authentication → Providers
→ Email**:

- **Confirm email.** On by default. New signups get no session until they click
  the link; `SignUp` detects this and sends them to sign-in with an explanation
  rather than into a guarded route. Turning it off signs users in immediately.
- **Minimum password length.** Defaults to 6, which is what the sign-up and
  reset forms state and validate. If you raise it in the dashboard, update
  `MIN_PASSWORD` in `src/pages/SignUp.jsx` and `src/pages/ResetPassword.jsx` so
  the client-side message stays truthful.

Supabase's built-in SMTP is heavily rate-limited and intended for development
only. Configure a real SMTP provider before any production traffic.

### A PKCE caveat worth knowing

This app uses the PKCE flow, which is the right choice for a browser app with no
backend: the code in a callback URL is useless without a verifier held in that
browser's storage, so an intercepted link cannot be replayed.

The trade-off is that **a recovery link must be opened in the same browser that
requested it.** Requesting a reset on a phone and opening the email on a laptop
will fail. The app handles this honestly — `ResetPassword` shows "This link has
expired" with a path to request a fresh one — but it is worth knowing before you
field the support ticket.

---

## 6. Removing a provider

If you are not ready to ship Google or Apple, edit the `providers` array in
`src/components/auth/OAuthButtons.jsx`. Removing an entry drops the button from
both Sign In and Sign Up; the layout adapts. Nothing else needs to change.

---

## How the app uses all this

| Concern | Where |
|---|---|
| Client construction, PKCE, storage key | `src/lib/supabase.js` |
| Session state machine, all auth actions | `src/context/AuthContext.jsx` |
| Route guarding, redirect-back on sign-in | `src/router/ProtectedRoute.jsx` |
| Keeping signed-in users off auth screens | `src/layouts/AuthLayout.jsx` |
| OAuth / email-confirmation return | `src/pages/AuthCallback.jsx` |
| Recovery landing page | `src/pages/ResetPassword.jsx` |

### Session behaviour

- The session is stored in `localStorage` under `homebuild.auth`, so it survives
  reloads and is shared across tabs of the same origin.
- Access tokens are refreshed automatically before expiry.
- `onAuthStateChange` fires in **other tabs** too, so signing out in one tab
  signs out the rest.
- Route guards hold on a `loading` state until the persisted session resolves.
  This is deliberate: treating that first async tick as "signed out" is what
  makes an app bounce a signed-in user to the login screen on every refresh.
- A password-recovery session is tracked separately from a normal one. It grants
  access to `/reset-password` and nothing else.

### What is still fixture data

Authentication is real. Everything behind it is not — projects, invoices,
schedules, contractors and alerts are all compiled-in fixtures. The Settings
screen shows a real name, email and provider, but `role`, `phone`, "Active
Projects" and "Teams Led" come from `demoProfile` in `src/data/user.js`, because
there is no database behind them yet.
