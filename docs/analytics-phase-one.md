# Ghosts In Shells Analytics — Phase One

## Existing setup before implementation

The website was a dependency-free static HTML/CSS/JavaScript site deployed from
GitHub Pages through `ghostsinshells.com`.

- No analytics product, tracking pixel, tag manager, backend, database,
  serverless API, cookie banner, or formal privacy-policy page was present.
- `localStorage` was used for phone preferences, story/message state, mail,
  RSVPs, and on-device music play counts. It was not a durable analytics store.
- External requests already existed for forms, RSVP email delivery, weather,
  maps/geocoding, Leaflet assets, and links to third-party sites.
- The calendar contains an EmailJS public client identifier. It is not an
  analytics or database secret, but it should remain restricted in EmailJS to
  the production origin.

## Architecture

The public website remains static. `js/analytics.js` supplies the reusable
`GISAnalytics.trackEvent(eventName, properties)` API. It creates first-party
anonymous visitor and session IDs, adds shared context, filters sensitive
metadata, queues temporary failures, and sends batches to a separate Cloudflare
Worker.

The Worker is a write-only public API backed by Cloudflare D1. It:

- accepts only allowed event names;
- validates identifiers, body size, metadata size, and allowed origins;
- rate-limits requests using the connecting IP only as a temporary abuse-control
  key (the IP is never used as visitor identity or written to the schema);
- obtains approximate country, region, and city only from Cloudflare request
  metadata;
- hashes invite tokens and validates them server-side;
- signs short-lived invite context so clients cannot assign themselves to a
  recipient;
- exposes no production analytics read endpoint or recipient listing;
- allows protected test inspection/reset only while `TEST_MODE=true` and with
  the admin bearer token.

Events are append-only. Duplicate event IDs are ignored. Visitor/session
summary rows are upserted.

## Files

Created:

- `js/analytics-config.js`
- `js/analytics.js`
- `analytics-worker/package.json`
- `analytics-worker/wrangler.toml.example`
- `analytics-worker/.dev.vars.example`
- `analytics-worker/migrations/0001_analytics.sql`
- `analytics-worker/src/events.js`
- `analytics-worker/src/security.js`
- `analytics-worker/src/worker.js`
- `analytics-worker/scripts/create-test-invite.js`
- `analytics-worker/test/security.test.js`
- `docs/analytics-phase-one.md`

Modified:

- `index.html`
- `js/app.js`
- `js/music.js`
- `js/messages.js`
- `js/mail.js`
- `js/stage.js`
- `js/calendar.js`

## Database schema

Migration: `analytics-worker/migrations/0001_analytics.sql`

Tables:

- `anonymous_visitors`
- `analytics_sessions`
- `analytics_events`
- `access_invites`
- `invite_recipients`
- `downloadable_assets`
- `music_tracks`
- `exposure_events`

The schema indexes event time/name, visitor, session, invite, and recipient
paths needed by a future Owner Analytics Dashboard. Approximate location is
nullable and is populated only from Cloudflare-provided request metadata.

## Allowed event names

Visitor/session:

`first_visit`, `returning_visit`, `session_started`, `session_ended`,
`page_loaded`, `route_viewed`, `time_on_site`

Phone access:

`lock_screen_viewed`, `swipe_up_attempted`, `face_id_scan_started`,
`face_id_success`, `face_id_failure`, `face_id_access_granted`,
`access_granted`, `access_denied`, `passcode_screen_viewed`,
`passcode_attempt`, `phone_unlocked`, `phone_returned_to_lock_screen`,
`home_screen_viewed`

Generic app/content:

`app_opened`, `app_closed`, `app_time_spent`, `section_viewed`,
`item_opened`, `external_link_clicked`, `download_button_clicked`,
`download_requested`, `download_completed`

Music:

`album_viewed`, `song_viewed`, `song_play_started`, `song_paused`,
`song_resumed`, `song_skipped`, `song_restarted`,
`song_playback_milestone`, `song_completed`, `music_file_downloaded`,
`next_song_selected`, `previous_song_selected`

Photos/artwork:

`artwork_viewed`, `image_enlarged`, `artwork_downloaded`

Mail:

`mailbox_viewed`, `mail_message_opened`, `mail_message_closed`,
`mail_link_clicked`, `mail_attachment_viewed`,
`mail_attachment_downloaded`, `reply_or_contact_clicked`

Messages:

`message_thread_opened`, `message_thread_closed`, `message_reply_selected`,
`message_image_viewed`, `message_link_clicked`,
`message_conversation_completed`

Camera/Exposure:

`exposure_section_opened`, `venue_viewed`, `exposure_event_viewed`,
`trailer_started`, `trailer_completed`, `exposure_event_entered`,
`media_playback_started`, `media_playback_paused`,
`media_playback_resumed`, `media_playback_milestone`,
`exposure_event_completed`, `rsvp_clicked`, `ticket_link_clicked`,
`ticket_redeemed`, `backstage_content_opened`, `soundcheck_content_opened`,
`performance_clip_opened`

Personalized DJ:

`dj_invite_opened`, `dj_invite_validated`, `dj_invite_rejected`,
`dj_invite_expired`, `authorized_recipient_recognized`,
`dj_phone_unlocked`, `first_dj_visit`, `repeat_dj_visit`,
`contact_link_clicked`

## Interactions currently instrumented

- First/returning visit, session start, best-effort session end, page load,
  route/hash view, time on site, visit count, and last visit.
- Lock-screen view, swipe attempt and distance, Face ID start/failure,
  passcode-screen view, passcode attempt (digit count only), access
  granted/denied, unlock, return to lock, and home-screen view.
- A validated DJ invite uses the existing Face ID sequence to record Face ID
  success/access and unlock the DJ session without exposing recipient data in
  the URL.
- Every current app open, app close, measured time in app, and root section
  view. Newly added apps automatically receive these generic events.
- External link clicks (host only, never query-string or form content).
- Anchors marked `download`: button click and download request, with asset
  metadata when supplied by `data-asset-*` attributes.
- Music album view, track view, play start, pause, resume, skip, restart,
  next/previous selection, 25/50/75/90-percent milestones once per play
  session, completion, runtime, position, percentage, and listening duration.
- Photos library view, artwork/photo view, and enlargement with ID, caption,
  category, and file type.
- Mailbox view, mail open/close, in-mail link click, and contact/reply CTA
  selection. No composed or form-entered text is sent to analytics.
- Messages list view, thread open/close, and reply interaction. Free-form reply
  analytics store only an interaction type and coarse character-count bucket;
  the text is never sent.
- Camera/Exposure venue and section view, event view, archive view, media
  start/pause/resume, 25/50/75/90-percent milestones, and completion.
- Calendar event view and RSVP button click. RSVP names/emails are not sent to
  analytics.
- DJ invite opened, validated, rejected/expired, recipient recognized, first
  DJ visit, repeat DJ visit, Face ID success, and DJ unlock.

Events listed in the allowlist but not emitted yet are schema-ready for future
DJ assets and features that do not currently exist in the public phone:
music/artwork download variants, mail attachments, predefined message
responses, trailers, ticket fulfillment/redemption, backstage/soundcheck
content, performance clips, and completed downloads.

## Deployed environments

Phase One uses separate Cloudflare Workers and D1 databases:

- Staging Worker:
  `https://ghosts-in-shells-analytics-staging.ghosts-in-shells-analytics.workers.dev`
- Production Worker:
  `https://ghosts-in-shells-analytics-production.ghosts-in-shells-analytics.workers.dev`
- Staging D1: `ghosts-in-shells-analytics-staging`
- Production D1: `ghosts-in-shells-analytics-production`

Migration `0001_analytics.sql` has been applied to both databases. The
production frontend is configured to use the production Worker. Production
allows only `https://ghostsinshells.com`; staging allows the explicit local
development origins. Production runs with `TEST_MODE=false`.

## Environment and deployment setup

Prerequisites: a Cloudflare account with Workers and D1 enabled, plus Wrangler
authentication.

1. In `analytics-worker`, copy `wrangler.toml.example` to `wrangler.toml`.
2. Create separate staging and production D1 databases, then place their
   database IDs in the ignored local `wrangler.toml`.
3. Generate two different random values of at least 32 bytes:
   `INVITE_SIGNING_SECRET` and `ADMIN_API_TOKEN`.
4. For local work, copy `.dev.vars.example` to `.dev.vars` and replace the
   sample values. Neither file should be committed.
5. For production, store both values with `wrangler secret put`; never place
   them in `js/analytics-config.js`.
6. Apply D1 migrations and deploy both Worker environments.
7. Put the production Worker URL in `js/analytics-config.js` as `endpoint`.
8. Keep production `ALLOWED_ORIGINS` limited to
   `https://ghostsinshells.com`; local development origins belong only in
   staging.

Production secrets:

- `INVITE_SIGNING_SECRET`
- `ADMIN_API_TOKEN`

Non-secret configuration:

- `ALLOWED_ORIGINS`
- `TEST_MODE`

## Local test

From the repository root:

1. Serve the static site on `http://localhost:8000`.
2. In `analytics-worker`, install dependencies, apply local migrations, and
   start the Worker.
3. Point `js/analytics-config.js` at the local Worker URL.
4. Open the phone. Localhost automatically prints each event to the browser
   console as `[Ghosts In Shells analytics]`.
5. Generate a test invite with `npm run create:test-invite`; run the printed SQL
   against local D1, then open the one-time printed URL.
6. Inspect only the selected test invite with:

   `GET /v1/test/events?invite_id=<test-invite-id>` and header
   `Authorization: Bearer <ADMIN_API_TOKEN>`.

7. Reset only the selected test invite with:

   `DELETE /v1/test/events?invite_id=<test-invite-id>` and the same
   authorization header.

The reset is accepted only for an invite marked `is_test=1` and deletes only
that invite's test analytics. Production analytics are untouched.

## Production test

1. Deploy the migration and Worker.
2. Temporarily set `TEST_MODE=true`.
3. Generate a new test invite, apply its printed SQL to remote D1, and open:
   `https://ghostsinshells.com/?invite=<secure-random-token>`.
4. Exercise Face ID, unlock, Music, milestones/completion, Photos, Mail,
   Camera/Exposure, and revisit the link in a new session.
5. Read the protected test endpoint with the production admin token.
6. Reset test data, then set `TEST_MODE=false` to remove the test read/reset
   surface.

## Phase One verification

Completed against the deployed staging Worker and D1:

- personalized DJ invite validation and the `Access Granted` Face ID journey;
- first and repeat DJ visit attribution;
- Music view/play events, 25/50/75/90-percent milestones, and completion;
- DJ music and artwork download requests;
- Photos artwork view, Mail message open, and Camera/Exposure event view;
- protected per-invite inspection followed by a reset to zero test events.

Completed against the deployed production Worker and D1:

- DJ invite validation with the production origin;
- a nine-event allowlisted batch covering invite attribution, playback,
  downloads, Mail, Exposure, and repeat visit;
- protected per-invite inspection followed by a reset to zero test events.

Automated Worker tests cover hashing, signed invite context and tamper
rejection, sensitive metadata removal, read-route protection, origin
enforcement, malformed/oversized/unapproved requests, rate limiting, and
expired/revoked invite rejection.

The raw invite token is displayed only once by the generator. D1 stores only
its SHA-256 hash. Recipient names are not part of the URL.

## Real DJ invite process (run only after approval)

The generator defaults to test records. After explicit approval, create the
real DJ Paris artifact with `--is-test=false` and a secure output path:

```sh
cd analytics-worker
node scripts/create-test-invite.js \
  --display-name="DJ Paris" \
  --access-type=DJ \
  --access-level="All Access" \
  --is-test=false \
  --site-url=https://ghostsinshells.com/ \
  --output-json=/secure/path/dj-paris-invite.json
```

Review the generated SQL, apply its `sql` value to
`ghosts-in-shells-analytics-production`, and deliver the generated
`inviteUrl` through the approved private channel. Delete the secure JSON after
delivery. Never paste the raw URL into source control, logs, or public chat.

## Privacy changes recommended before production

Add a privacy policy linked from the public site that explains:

- first-party anonymous IDs in browser storage;
- event, device, referral, campaign, and approximate-location collection;
- purposes, retention period, processors (Cloudflare), and contact method;
- personalized industry invite attribution;
- how visitors can opt out or erase the device-local anonymous identifier.

The current Settings privacy copy says music activity remains on the device;
that sentence must be updated before production analytics are enabled because
playback events will then be sent to the analytics API.

The implementation honors Global Privacy Control and `Do Not Track: 1` by
disabling collection. Whether a consent banner is legally required depends on
the visitor jurisdictions, lawful basis, and final retention/use policy. Obtain
privacy counsel before enabling production tracking. A banner is advisable if
consent is the chosen lawful basis or if future non-essential cookies/third-
party advertising analytics are added. Terms of use should mention the
personalized invite conditions, but Phase One does not itself require a terms
redesign.

## Limitations

- Browser session-end events, time on site, and completed downloads are
  inherently best effort. Tabs can crash or lose connectivity.
- GitHub Pages cannot confirm downloads server-side. Reliable completion or
  authorization requires serving protected downloads through the Worker/R2 in
  a later phase.
- Approximate location is available only after deployment behind Cloudflare and
  can be absent. Precise GPS is never requested.
- Browser/OS detection is intentionally coarse and is not fingerprinting.
- Visitors who clear site data receive a new anonymous ID.
- Free-form message and form contents, passcodes, passwords, precise location,
  and raw IP addresses are never included in analytics events.
- Feature-specific events can only fire when the corresponding feature exists.
  The allowlist and metadata model are ready for future DJ music versions,
  downloads, attachments, ticketing, and private Exposure content.

## Security confirmation

No database credentials, D1 identifiers with authority, service-role keys,
invite signing secrets, admin tokens, recipient lists, or analytics read
credentials are present in frontend code. The frontend contains only the public
write API URL. The Worker binding supplies database access server-side.

The site’s CSS, layout, copy, and public phone journey were not redesigned.
The only personalized behavior added is the requested validated DJ invite
Face ID success path; the existing public experience is unchanged.
