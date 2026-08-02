# Ghosts In Shells DJ Phone

## Entry and access

The DJ phone uses a private, recipient-specific route with a secure invite
query parameter:

`https://www.ghostsinshells.com/djparislife/?invite=<secure-random-token>`

The route is not an authentication boundary by itself. Without a valid token,
it displays only a private-access notice. The production Worker validates the
token, and DJ mode becomes available only when the signed context has
`accessType: "DJ"`. Invalid, malformed, expired, revoked, or unavailable
validation never activates DJ mode and never falls back to the public phone.

The Face ID sequence waits for invite validation before deciding access. A
valid invite displays:

- `ACCESS GRANTED`
- the signed recipient display name
- `ALL ACCESS CREDENTIAL VERIFIED`

It then unlocks into the five-app Industry Access home: Music, Photos, Mail,
Exposure, and Settings. The public phone continues using its original home,
apps, dock, mail, and passcode journey.

## Files

Created:

- `js/dj-phone.js`
- `data/dj/phone.json`
- `analytics-worker/migrations/0002_dj_phone_recipient_assets.sql`
- `analytics-worker/migrations/0003_private_download_audit.sql`
- `analytics-worker/src/private-assets.js`
- `docs/dj-private-assets.md`
- `docs/dj-iphone-safari-checklist.md`
- `docs/dj-phone.md`

Modified:

- `index.html`
- `css/style.css`
- `js/app.js`
- `js/analytics.js`
- `analytics-worker/src/events.js`
- `analytics-worker/src/worker.js`
- `analytics-worker/scripts/create-test-invite.js`
- `analytics-worker/test/worker.test.js`

## Recipient-specific artwork

Migration `0002_dj_phone_recipient_assets.sql` adds nullable
`invite_recipients.personalized_artwork_path`. The Worker accepts only a
relative image path under `media/`, rejects traversal and URL schemes, and
places only an availability flag inside the signed invite context. Protected
delivery derives the recipient-specific R2 key on the Worker. No recipient
list, object key, or mapping is shipped in frontend code.

The generator accepts:

`--personalized-artwork-path=media/dj/recipients/<recipient-id>/face-id-licensed-preview.jpg`

The image itself must be created and supplied manually. This project does not
generate, watermark, edit, or recreate it.

## Current music and artwork

Available now:

- Face ID M4A, 2:11
- White Bronco M4A, 3:17
- Amber M4A, 3:20
- Three protected DJ cover images delivered through the Worker and private R2
- Public Saint Ed X logo at `media/dj/brand/saint-ed-x-logo.png`

Clean versions, MP3/WAV masters, vertical artwork, and press images are not
shown until real files are supplied. Reserved repository directories remain
available for those future assets without producing empty UI slots.

## Protected downloads

New masters use private R2 storage and `POST /v1/downloads/:asset-id`. The
Worker verifies the signed context and live D1 invite, resolves a server-side
allowlist, rate limits by invite and asset, and streams the file. Details and
exact upload commands are in `docs/dj-private-assets.md`.

The M4A previews and Saint Ed X logo remain public promotional files. The
personalized covers and all future private masters stay out of GitHub Pages.

## Mail

DJ mode uses a separate fixed inbox and never loads the sponsor-ad inbox:

1. `ALL ACCESS APPROVED` — Ghosts In Shells
2. `FACE ID — LICENSED PREVIEW` — Saint Ed X / Ghosts In Shells
3. `EXPOSURE ACCESS` — Exposure
4. `REQUEST A DJ DROP` — Ghosts In Shells

The DJ-drop action opens an email addressed to
`d.wright@ghostsinshells.com`. Analytics records only the action and message
ID; no visitor-entered email body is collected.

## Analytics

DJ mode uses the existing anonymous visitor, session, signed invite, recipient,
device, campaign, timestamp, and metadata pipeline.

New allowlisted events:

- `dj_home_screen_viewed`
- `music_version_selected`
- `song_repeat_played`
- `music_mp3_downloaded`
- `music_wav_downloaded`
- `music_clean_downloaded`
- `music_explicit_downloaded`
- `photo_folder_opened`
- `official_artwork_downloaded`
- `personalized_artwork_downloaded`
- `vertical_artwork_downloaded`
- `logo_downloaded`
- `press_image_downloaded`
- `dj_drop_request_clicked`
- `credential_status_viewed`
- `event_preview_clicked`

Existing generic, music, artwork, mail, Exposure, invite, and app events remain
in use. Milestones are held in a per-play-session set and fire at most once for
25, 50, 75, and 90 percent within that session.

Every analytics call is optional and network failures are queued or ignored;
playback, downloads, navigation, and access do not depend on a successful
analytics request.

## Test invite

Generate a fake invite without printing the token:

```sh
cd analytics-worker
node scripts/create-test-invite.js \
  --display-name="DJ Phone Test" \
  --access-type=DJ \
  --access-level="All Access Test" \
  --is-test=true \
  --site-url=http://localhost:8000/ \
  --output-json=/secure/path/dj-phone-test.json
```

Apply only the generated `sql` value to the staging D1 database. The JSON is
mode `0600`; delete it after testing.

## DJ Paris process — only after explicit approval

1. Supply and verify every real audio/artwork asset.
2. Upload private masters to the documented private R2 keys.
3. Manually create the licensed-preview artwork with the approved watermark.
4. Upload it at the recipient-specific path.
5. Run the generator with the approved display name, access level,
   `--is-test=false`, and `--personalized-artwork-path`.
6. Apply the generated SQL to production D1.
7. Deliver the one-time URL through the approved private channel.
8. Delete the secure generator output.

No DJ Paris invite exists as part of this branch.

## Deployment and rollback

Deployment after approval:

1. Apply migrations `0002` and `0003` to production D1.
2. Deploy the production Worker.
3. Merge the reviewed branch into `main`.
4. Wait for GitHub Pages to report `built`.
5. Run one production test invite, inspect its events, reset it, and remove the
   test recipient.
6. Keep the real invite on hold until the asset and download-security gates are
   satisfied.

Rollback:

1. Revert the merge commit on `main` to restore the previous static frontend.
2. Roll the Worker back to its immediately previous production version.
3. Leave the additive nullable D1 column in place; it is backward-compatible
   and does not alter existing records.
