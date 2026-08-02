# Ghosts In Shells Owner Phone

Phase One adds a hidden, server-authenticated administrative interface inside:

`Settings → General → Phone Storage → System`

## Security boundary

- The owner passcode is never present in HTML, JavaScript, Git, or D1.
- Configure `OWNER_PASSCODE_HASH` as a Cloudflare Worker secret containing the
  lowercase SHA-256 hex digest of the selected passcode.
- Authentication returns a random eight-hour session token. Only its SHA-256
  hash is stored in D1. The browser keeps the raw token in `sessionStorage`, so
  it is removed when the tab session ends.
- Every owner read and mutation revalidates that session server-side.
- Owner login uses the `OWNER_AUTH_RATE_LIMITER` binding.
- Audit records contain action names, internal target IDs, and allowlisted
  metadata only. They do not contain passcodes, session tokens, invite tokens,
  raw IP addresses, or message/form contents.

## Phase One capabilities

- System diagnostics and live session summaries
- Production analytics views backed by D1
- Credential listing, privacy-safe activity, disable, enable, revoke, and
  device-authorization reset
- Content catalog reads and owner-managed metadata
- Privacy-safe administrative audit log
- Configuration/status view

Push Center is intentionally future-ready. It provides audience and composition
controls, but scheduling and sending remain disabled until a delivery provider
is implemented. R2 upload controls are also withheld until a server-side upload
pipeline is configured; object keys are never returned to the owner UI.

## Deployment prerequisites

1. Apply `migrations/0005_owner_phone.sql` to the target D1 database.
2. Add the `OWNER_AUTH_RATE_LIMITER` binding.
3. Set `OWNER_PASSCODE_HASH` with `wrangler secret put`; never put it in
   `wrangler.toml`.
4. Deploy the Worker and frontend together.
5. Run the owner and public/DJ regression suites.

This branch is not production-ready until the owner supplies the passcode and
explicitly approves deployment.
