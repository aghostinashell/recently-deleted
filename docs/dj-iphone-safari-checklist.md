# DJ phone physical iPhone/Safari checklist

## Staging setup without a real recipient

1. Keep the production analytics URL unchanged in committed code.
2. Generate a new `DJ Phone Test` invite with `--is-test=true`; apply its SQL
   only to the staging D1 database.
3. On the Mac and iPhone, join the same trusted Wi-Fi network.
4. Obtain the Mac address with `ipconfig getifaddr en0`.
5. Temporarily add `http://<MAC_LAN_IP>:8000` to staging
   `ALLOWED_ORIGINS`, deploy the staging Worker, and temporarily point the
   uncommitted local `js/analytics-config.js` endpoint to the staging Worker.
6. From the repository root, run `python3 -m http.server 8000 --bind 0.0.0.0`.
7. Privately send
   `http://<MAC_LAN_IP>:8000/?invite=<TEST_TOKEN>` to the iPhone through Mail
   or Messages. Never paste the token into an issue, PR, analytics query, or
   shell history.
8. After testing, restore the local analytics config, remove the temporary
   staging origin, reset/delete the test invite analytics, delete the test
   recipient/invite/audit rows, and securely delete the token file.

Use synthetic R2 fixtures for staging. Do not upload production masters and do
not create a DJ Paris record for this review.

## Checklist

- [ ] Open the private staging link from iOS Mail.
- [ ] Repeat from Messages.
- [ ] Confirm the Face ID animation begins and completes cleanly.
- [ ] Confirm `DJ Phone Test` and the signed access level appear; no production
      recipient name appears.
- [ ] Rotate once and return to portrait; confirm the phone remains usable.
- [ ] Check the notch/Dynamic Island, home indicator, top and bottom safe areas.
- [ ] Confirm the shell fits the visual viewport when Safari chrome expands
      and collapses.
- [ ] Confirm the body does not scroll behind the phone and modal/app scrolling
      remains contained.
- [ ] Open Music and start the public preview with a user gesture.
- [ ] Confirm pause, resume, restart, seek, elapsed time, and duration.
- [ ] Lock the phone during playback, unlock it, and confirm the UI reflects
      the interrupted/current media state.
- [ ] Background Safari, return, and confirm playback controls recover.
- [ ] Download the synthetic protected MP3 and confirm the expected filename.
- [ ] Download the synthetic protected WAV and confirm the expected filename.
- [ ] Confirm both downloads hand off to the iOS Files sheet/app.
- [ ] Open official artwork, enlarge it, close it, and download it.
- [ ] If a synthetic personalized image is enabled, confirm only that test
      recipient’s image loads and downloads.
- [ ] Open all four Mail messages and return to the inbox each time.
- [ ] Tap Request a DJ Drop and confirm Mail opens addressed to
      `d.wright@ghostsinshells.com` without sending anything.
- [ ] Open Exposure and confirm `NO ACTIVE EVENT`.
- [ ] Open Settings and confirm test recipient, DJ access, active status,
      issuer, issue date, and public pass number only.
- [ ] Close Safari, reopen the same link, and confirm it records a return visit.
- [ ] Open an altered/invalid invite and confirm DJ mode never unlocks.
- [ ] Open the site without `invite` and complete the normal public Face ID
      failure/passcode/public-app journey.

Record the iPhone model, iOS version, Safari version, network type, failures,
screenshots, and whether MP3/WAV filenames survived the Files handoff.
