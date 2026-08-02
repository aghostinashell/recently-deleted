# DJ private asset delivery

## Architecture

Restricted DJ files live in private Cloudflare R2 buckets. Neither bucket
should have an `r2.dev` URL or custom public domain enabled.

| Environment | Bucket | Worker binding |
| --- | --- | --- |
| Staging | `ghosts-in-shells-dj-private-staging` | `DJ_PRIVATE_ASSETS` |
| Production | `ghosts-in-shells-dj-private-production` | `DJ_PRIVATE_ASSETS` |

The browser requests a fixed asset ID from
`POST /v1/downloads/:asset-id` and supplies its signed invite context in the
JSON body. The Worker:

1. verifies the signed context and its short lifetime;
2. re-reads the invite and recipient from D1;
3. rejects revoked, expired, missing, non-DJ, or mismatched records;
4. resolves the fixed asset ID through `src/private-assets.js`;
5. applies the per-invite/per-asset `DOWNLOADS_RATE_LIMITER`;
6. streams the R2 object with a fixed MIME type and download filename; and
7. writes a best-effort privacy-safe audit record.

No browser input becomes an R2 key. The audit stores no raw invite token,
signed context, object key, IP address, location, or free-form content.
Audit failure cannot block an authorized stream.

## Face ID production masters

| Asset ID | Required local filename | Private R2 object key | MIME type |
| --- | --- | --- | --- |
| `face-id-explicit-mp3` | `saint-ed-x-face-id-explicit.mp3` | `releases/face-id/masters/saint-ed-x-face-id-explicit.mp3` | `audio/mpeg` |
| `face-id-clean-mp3` | `saint-ed-x-face-id-clean.mp3` | `releases/face-id/masters/saint-ed-x-face-id-clean.mp3` | `audio/mpeg` |
| `face-id-explicit-wav` | `saint-ed-x-face-id-explicit.wav` | `releases/face-id/masters/saint-ed-x-face-id-explicit.wav` | `audio/wav` |
| `face-id-clean-wav` | `saint-ed-x-face-id-clean.wav` | `releases/face-id/masters/saint-ed-x-face-id-clean.wav` | `audio/wav` |

Create the production bucket only after release approval:

```sh
cd analytics-worker
npx wrangler r2 bucket create ghosts-in-shells-dj-private-production
```

Upload from a private local asset directory. These commands never copy the
masters into the repository:

```sh
npx wrangler r2 object put ghosts-in-shells-dj-private-production/releases/face-id/masters/saint-ed-x-face-id-explicit.mp3 --file="/ABSOLUTE/PRIVATE/PATH/saint-ed-x-face-id-explicit.mp3" --content-type="audio/mpeg" --remote
npx wrangler r2 object put ghosts-in-shells-dj-private-production/releases/face-id/masters/saint-ed-x-face-id-clean.mp3 --file="/ABSOLUTE/PRIVATE/PATH/saint-ed-x-face-id-clean.mp3" --content-type="audio/mpeg" --remote
npx wrangler r2 object put ghosts-in-shells-dj-private-production/releases/face-id/masters/saint-ed-x-face-id-explicit.wav --file="/ABSOLUTE/PRIVATE/PATH/saint-ed-x-face-id-explicit.wav" --content-type="audio/wav" --remote
npx wrangler r2 object put ghosts-in-shells-dj-private-production/releases/face-id/masters/saint-ed-x-face-id-clean.wav --file="/ABSOLUTE/PRIVATE/PATH/saint-ed-x-face-id-clean.wav" --content-type="audio/wav" --remote
```

Dashboard alternative: R2 Object Storage → select
`ghosts-in-shells-dj-private-production` → Upload → preserve the exact object
key shown above → verify the HTTP content type. In Settings, confirm Public
Development URL is disabled and no custom domain is attached.

After verifying each upload, change only the corresponding
`available` value in `data/dj/phone.json` to `true` and update the matching
availability flags. Instrumental, acapella, and radio-edit controls do not
exist and should remain absent until real assets are supplied.

All fixed masters authorize only `DJ` access. Recipients see the release label
and format, press Download, wait for server authorization, and receive the
friendly filename defined in `src/private-assets.js`. They never see the R2
key or receive a permanent object URL.

## Personalized licensed-preview artwork

The protected object key is derived by the Worker:

`recipients/<recipient-id>/artwork/face-id-licensed-preview.jpg`

The supplied finished JPEG should contain:

```text
LICENSED PREVIEW
AUTHORIZED RECIPIENT:
DJ PARIS
```

Do not create or upload this asset until the real recipient has been approved.
After approval, upload it with:

```sh
npx wrangler r2 object put ghosts-in-shells-dj-private-production/recipients/<recipient-id>/artwork/face-id-licensed-preview.jpg --file="/ABSOLUTE/PRIVATE/PATH/saint-ed-x-face-id-licensed-preview.jpg" --content-type="image/jpeg" --remote
```

The invite record must opt into personalized artwork, and the frontend
`personalized-licensed-preview` slot must be enabled. The Worker derives the
recipient-specific key from the live authorized recipient; the client cannot
select another recipient’s key.

## Release metadata

`data/dj/phone.json` is the single frontend configuration location for:

- artist
- track title
- release date
- runtime
- BPM
- musical key
- explicit/clean availability
- MP3/WAV availability
- artwork paths and protected asset IDs

Known values are `Saint Ed X` and `Face ID`. Values still required from the
release owner are:

- final release date;
- final master runtime;
- BPM;
- musical key;
- confirmation that explicit and clean versions are approved;
- confirmation that each MP3 and WAV master has been delivered.

Null values remain visibly “Awaiting metadata”; nothing is guessed.

## Artwork delivery

| Asset | Format and recommended dimensions | Filename | Delivery |
| --- | --- | --- | --- |
| Official Face ID cover | JPG, sRGB, 3000×3000 | `01-face-id.jpg` | Public at `media/artwork/recently-deleted/01-face-id.jpg` |
| Personalized licensed preview | JPG, sRGB, 3000×3000 | `saint-ed-x-face-id-licensed-preview.jpg` | Protected R2 recipient key |
| Vertical promo artwork | JPG, sRGB, 2160×2700 (4:5) | `saint-ed-x-face-id-vertical.jpg` | Public at `media/dj/face-id/` |
| Saint Ed X logo | Transparent PNG, at least 2000 px on longest edge | `saint-ed-x-logo.png` | Public at `media/dj/brand/` |
| Approved promotional image | JPG, sRGB, at least 2400×3000 | `saint-ed-x-approved-press.jpg` | Public at `media/dj/press/` |

The official cover, vertical promo, logo, and approved promotional image are
promotional materials and can remain public. The recipient-named licensed
preview must use protected delivery. Source artwork, layered files, and
unreleased alternates should also remain private and should not be added to
the public configuration.

## Deployment and rollback

Staging sequence:

1. Create the staging R2 bucket.
2. Apply migration `0003_private_download_audit.sql` to staging only.
3. Upload synthetic fixtures under the allowlisted keys.
4. Deploy the staging Worker and run the security matrix.
5. Delete synthetic fixtures and test invite/audit records.

Production sequence, only after approval:

1. Create and privately configure the production bucket.
2. Upload verified release assets.
3. Apply migrations `0002` and `0003` to production.
4. Deploy the production Worker with its R2 and rate-limit bindings.
5. Deploy the matching frontend, then run one removable production test.

Rollback the Worker to its preceding version and revert the frontend commit.
The additive D1 tables/columns can remain unused. If R2 rollback is required,
disable the binding first, then delete objects and the bucket only after
confirming no approved invite relies on them.
