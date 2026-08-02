"use strict";

(function createDjPhone() {
  const CONFIG_URL = "data/dj/phone.json";
  const audio = new Audio();
  audio.preload = "metadata";
  audio.playsInline = true;

  let configPromise = null;
  let activeHost = null;
  let selectedFile = null;
  let playSessionId = "";
  let playbackStarted = false;
  let resumedAfterPause = false;
  let playbackEnded = false;
  let suppressPause = false;
  let milestones = new Set();
  let playStartedAt = 0;

  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
  const track = (name, metadata = {}, options = {}) =>
    window.GISAnalytics?.trackEvent(name, metadata, options);

  function context() {
    return window.GISAnalytics?.context().inviteContext || null;
  }

  function isActive() {
    const analyticsContext = window.GISAnalytics?.context();
    return analyticsContext?.accessType === "DJ" && Boolean(analyticsContext?.inviteContext);
  }

  function config() {
    if (!configPromise) {
      configPromise = fetch(CONFIG_URL).then((response) => {
        if (!response.ok) throw new Error("DJ phone configuration is unavailable.");
        return response.json();
      });
    }
    return configPromise;
  }

  function trackMetadata(extra = {}) {
    const music = window.DJPhone?.configuration?.music;
    return {
      app_name: "music",
      song_id: music?.id || "face-id",
      song_title: music?.title || "Face ID",
      content_id: music?.id || "face-id",
      content_title: music?.title || "Face ID",
      version: selectedFile?.version || null,
      file_format: selectedFile?.format?.toLowerCase() || null,
      runtime: Number.isFinite(audio.duration) ? Math.round(audio.duration) : music?.runtimeSeconds || null,
      playback_position: Math.round(audio.currentTime || 0),
      percentage_completed: Number.isFinite(audio.duration) && audio.duration > 0
        ? Math.round((audio.currentTime / audio.duration) * 100) : 0,
      play_session_id: playSessionId,
      ...extra
    };
  }

  function resetPlaybackSession() {
    playSessionId = crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`;
    playbackStarted = false;
    resumedAfterPause = false;
    playbackEnded = false;
    milestones = new Set();
    playStartedAt = 0;
  }

  function selectFile(file, shouldPlay = false) {
    if (!file?.path) return;
    suppressPause = true;
    audio.pause();
    selectedFile = file;
    resetPlaybackSession();
    audio.src = file.path;
    suppressPause = false;
    track("music_version_selected", trackMetadata({
      file_id: file.id,
      file_label: file.label
    }));
    renderMusicStatus();
    if (shouldPlay) audio.play().catch(() => {});
  }

  function renderMusicStatus() {
    if (!activeHost?.querySelector(".dj-music-app")) return;
    const duration = Number.isFinite(audio.duration) ? audio.duration
      : window.DJPhone?.configuration?.music?.runtimeSeconds || 0;
    const percentage = duration > 0 ? Math.min(100, (audio.currentTime / duration) * 100) : 0;
    const seek = activeHost.querySelector("[data-dj-seek]");
    if (seek) {
      seek.value = String(percentage);
      seek.style.setProperty("--progress", `${percentage}%`);
    }
    const elapsed = activeHost.querySelector("[data-dj-elapsed]");
    const total = activeHost.querySelector("[data-dj-duration]");
    if (elapsed) elapsed.textContent = formatTime(audio.currentTime || 0);
    if (total) total.textContent = formatTime(duration);
    const toggle = activeHost.querySelector("[data-dj-music-toggle]");
    if (toggle) {
      toggle.textContent = audio.paused ? "▶" : "Ⅱ";
      toggle.setAttribute("aria-label", audio.paused ? "Play Face ID" : "Pause Face ID");
    }
    activeHost.querySelectorAll("[data-dj-version]").forEach((button) => {
      button.classList.toggle("active", button.dataset.djVersion === selectedFile?.id);
    });
  }

  function formatTime(seconds) {
    const safe = Math.max(0, Math.floor(Number(seconds) || 0));
    return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
  }

  audio.addEventListener("loadedmetadata", renderMusicStatus);
  audio.addEventListener("timeupdate", () => {
    renderMusicStatus();
    const percentage = trackMetadata().percentage_completed;
    [25, 50, 75, 90].forEach((milestone) => {
      if (percentage >= milestone && !milestones.has(milestone)) {
        milestones.add(milestone);
        track("song_playback_milestone", trackMetadata({ milestone }));
      }
    });
  });
  audio.addEventListener("play", () => {
    if (playbackEnded) {
      resetPlaybackSession();
      track("song_repeat_played", trackMetadata());
    }
    if (!playbackStarted) {
      playbackStarted = true;
      playStartedAt = Date.now();
      track("song_play_started", trackMetadata());
    } else if (resumedAfterPause) {
      resumedAfterPause = false;
      track("song_resumed", trackMetadata());
    }
    renderMusicStatus();
  });
  audio.addEventListener("pause", () => {
    if (!suppressPause && playbackStarted && !audio.ended) {
      resumedAfterPause = true;
      track("song_paused", trackMetadata());
    }
    renderMusicStatus();
  });
  audio.addEventListener("ended", () => {
    playbackEnded = true;
    track("song_completed", trackMetadata({
      percentage_completed: 100,
      listening_duration: Math.round((Date.now() - playStartedAt) / 1000)
    }));
    renderMusicStatus();
  });

  async function openMusic(host) {
    const data = await config();
    window.DJPhone.configuration = data;
    const music = data.music;
    const files = music.files || [];
    selectedFile = files.find((file) => file.path) || null;
    if (selectedFile && audio.src !== new URL(selectedFile.path, location.href).href) {
      selectFile(selectedFile);
    }
    track("song_viewed", {
      app_name: "music",
      song_id: music.id,
      song_title: music.title,
      content_id: music.id,
      content_title: music.title
    }, { dedupeKey: `dj-${music.id}-${window.GISAnalytics?.context().sessionId}` });
    host.innerHTML = `
      <section class="dj-app dj-music-app">
        <header class="dj-app-kicker"><span>DJ PROMO SERVICE</span><b>${esc(data.label)}</b></header>
        <div class="dj-music-hero">
          <img src="${esc(music.cover)}" alt="${esc(music.title)} official cover">
          <div><small>NOW SERVICING</small><h2>${esc(music.title)}</h2><p>${esc(music.artist)}</p></div>
        </div>
        <dl class="dj-track-facts">
          <div><dt>Runtime</dt><dd>${formatTime(music.runtimeSeconds)}</dd></div>
          <div><dt>BPM</dt><dd>${music.bpm || "Awaiting metadata"}</dd></div>
          <div><dt>Key</dt><dd>${music.key || "Awaiting metadata"}</dd></div>
          <div><dt>Release</dt><dd>${esc(music.releaseInformation)}</dd></div>
        </dl>
        <div class="dj-player">
          <input data-dj-seek type="range" min="0" max="100" value="0" step="0.1" aria-label="Seek through Face ID">
          <div class="dj-player-time"><span data-dj-elapsed>0:00</span><span data-dj-duration>${formatTime(music.runtimeSeconds)}</span></div>
          <div class="dj-player-controls">
            <button type="button" data-dj-restart aria-label="Restart Face ID">↶</button>
            <button class="dj-primary-play" type="button" data-dj-music-toggle aria-label="Play Face ID">▶</button>
          </div>
        </div>
        <section class="dj-file-section">
          <header><h3>Version & File Access</h3><p>Unavailable masters are shown with their required delivery filename.</p></header>
          <div class="dj-file-list">${files.map((file) => file.path ? `
            <article class="dj-file available">
              <button type="button" data-dj-version="${esc(file.id)}"><span><strong>${esc(file.label)}</strong><small>${esc(file.version)} · ${esc(file.format)}</small></span><b>SELECT</b></button>
              <a href="${esc(file.path)}" download data-dj-music-download="${esc(file.id)}"
                data-asset-id="${esc(file.id)}" data-asset-title="${esc(music.title)} ${esc(file.label)}"
                data-asset-category="dj-music">DOWNLOAD</a>
            </article>` : `
            <article class="dj-file unavailable"><span><strong>${esc(file.label)}</strong><small>Asset required</small></span><code>${esc(file.requiredPath)}</code></article>`
          ).join("")}</div>
        </section>
      </section>`;
    activeHost = host;
    host.querySelector("[data-dj-music-toggle]").addEventListener("click", () => {
      if (!selectedFile) return;
      if (audio.paused) audio.play().catch(() => {});
      else audio.pause();
    });
    host.querySelector("[data-dj-restart]").addEventListener("click", () => {
      if (!selectedFile) return;
      audio.currentTime = 0;
      resetPlaybackSession();
      track("song_restarted", trackMetadata());
      audio.play().catch(() => {});
    });
    host.querySelector("[data-dj-seek]").addEventListener("input", (event) => {
      if (Number.isFinite(audio.duration)) audio.currentTime = (Number(event.target.value) / 100) * audio.duration;
    });
    host.querySelectorAll("[data-dj-version]").forEach((button) => button.addEventListener("click", () => {
      selectFile(files.find((file) => file.id === button.dataset.djVersion));
    }));
    host.querySelectorAll("[data-dj-music-download]").forEach((link) => link.addEventListener("click", () => {
      const file = files.find((item) => item.id === link.dataset.djMusicDownload);
      const metadata = trackMetadata({
        asset_id: file.id,
        asset_title: `${music.title} ${file.label}`,
        asset_category: "dj-music"
      });
      track("music_file_downloaded", metadata);
      if (file.format === "MP3") track("music_mp3_downloaded", metadata);
      if (file.format === "WAV") track("music_wav_downloaded", metadata);
      if (file.version === "clean") track("music_clean_downloaded", metadata);
      if (file.version === "explicit") track("music_explicit_downloaded", metadata);
    }));
    renderMusicStatus();
  }

  function resolvedPhotos(data) {
    const personalizedPath = context()?.personalizedArtworkPath;
    return data.photos.map((asset) => asset.recipientConfigured && personalizedPath
      ? { ...asset, path: personalizedPath }
      : asset);
  }

  async function openPhotos(host) {
    const data = await config();
    const assets = resolvedPhotos(data);
    track("photo_folder_opened", { app_name: "photos", content_id: "face-id-dj-assets", content_title: "Face ID DJ Assets" });
    host.innerHTML = `
      <section class="dj-app dj-photos-app">
        <header class="dj-app-kicker"><span>APPROVED ASSETS</span><b>FACE ID</b></header>
        <div class="dj-photo-grid">${assets.map((asset) => asset.path ? `
          <button type="button" class="dj-photo-card" data-dj-photo="${esc(asset.id)}">
            <img src="${esc(asset.path)}" alt="${esc(asset.label)}">
            <span><strong>${esc(asset.label)}</strong><small>${esc(asset.fileType)} · Available</small></span>
          </button>` : `
          <article class="dj-photo-card unavailable">
            <div class="dj-missing-asset">ASSET<br>REQUIRED</div>
            <span><strong>${esc(asset.label)}</strong><small>${esc(asset.fileType)} · Not supplied</small></span>
            <code>${esc(asset.requiredPath)}</code>
          </article>`).join("")}</div>
        <div class="dj-photo-viewer" data-dj-photo-viewer hidden></div>
      </section>`;
    host.querySelectorAll("[data-dj-photo]").forEach((button) => button.addEventListener("click", () => {
      const asset = assets.find((item) => item.id === button.dataset.djPhoto);
      track("artwork_viewed", {
        app_name: "photos", asset_id: asset.id, asset_title: asset.label,
        asset_category: asset.category, file_type: asset.fileType.toLowerCase()
      });
      track("image_enlarged", { app_name: "photos", asset_id: asset.id, asset_title: asset.label });
      const viewer = host.querySelector("[data-dj-photo-viewer]");
      viewer.hidden = false;
      viewer.innerHTML = `<button type="button" data-close-dj-photo aria-label="Close artwork">×</button>
        <img src="${esc(asset.path)}" alt="${esc(asset.label)} full size">
        <div><strong>${esc(asset.label)}</strong><small>${esc(asset.fileType)}</small>
        <a href="${esc(asset.path)}" download data-dj-photo-download="${esc(asset.id)}"
          data-asset-id="${esc(asset.id)}" data-asset-title="${esc(asset.label)}"
          data-asset-category="${esc(asset.category)}">DOWNLOAD ASSET</a></div>`;
      viewer.querySelector("[data-close-dj-photo]").addEventListener("click", () => { viewer.hidden = true; });
      viewer.querySelector("[data-dj-photo-download]").addEventListener("click", () => {
        const metadata = {
          app_name: "photos", asset_id: asset.id, asset_title: asset.label,
          asset_category: asset.category, file_type: asset.fileType.toLowerCase()
        };
        track("artwork_downloaded", metadata);
        const eventName = {
          official: "official_artwork_downloaded",
          personalized: "personalized_artwork_downloaded",
          vertical: "vertical_artwork_downloaded",
          logo: "logo_downloaded",
          press: "press_image_downloaded"
        }[asset.category];
        if (eventName) track(eventName, metadata);
      });
    }));
  }

  async function openMail(host) {
    const data = await config();
    const messages = data.mail;
    track("mailbox_viewed", { app_name: "mail", mailbox: "all-access" });
    const renderInbox = () => {
      host.innerHTML = `<section class="dj-app dj-mail-app">
        <header class="dj-mail-header"><span>${esc(data.label)}</span><h2>Inbox</h2><small>${messages.length} messages</small></header>
        <div class="dj-mail-list">${messages.map((message) => `
          <button type="button" data-dj-mail="${esc(message.id)}"><i></i><span><strong>${esc(message.sender)}</strong>
          <b>${esc(message.subject)}</b><p>${esc(message.preview)}</p></span><em>›</em></button>`).join("")}</div>
      </section>`;
      host.querySelectorAll("[data-dj-mail]").forEach((button) => button.addEventListener("click", () => {
        renderMessage(messages.find((message) => message.id === button.dataset.djMail));
      }));
    };
    const renderMessage = (message) => {
      track("mail_message_opened", {
        app_name: "mail", content_id: message.id, content_title: message.subject
      });
      const action = message.action === "music" ? `<button type="button" data-dj-mail-app="music">OPEN MUSIC</button>`
        : message.action === "stage" ? `<button type="button" data-dj-mail-app="stage">OPEN EXPOSURE</button>`
        : message.action === "dj-drop" ? `<a href="mailto:${esc(data.contactEmail)}?subject=${encodeURIComponent("Saint Ed X DJ Drop Request")}" data-dj-drop>REQUEST A DJ DROP</a>`
        : "";
      host.innerHTML = `<article class="dj-app dj-mail-message">
        <button type="button" data-dj-mail-back>‹ Inbox</button>
        <header><span>${esc(message.sender)}</span><h2>${esc(message.subject)}</h2></header>
        <div>${message.body.map((paragraph) => `<p>${esc(paragraph)}</p>`).join("")}</div>
        ${action}
      </article>`;
      host.querySelector("[data-dj-mail-back]").addEventListener("click", () => {
        track("mail_message_closed", { app_name: "mail", content_id: message.id });
        renderInbox();
      });
      host.querySelector("[data-dj-mail-app]")?.addEventListener("click", (event) => {
        track("mail_link_clicked", {
          app_name: "mail", content_id: message.id,
          destination_app: event.currentTarget.dataset.djMailApp
        });
        document.querySelector(`[data-app-id="${event.currentTarget.dataset.djMailApp}"]`)?.click();
      });
      host.querySelector("[data-dj-drop]")?.addEventListener("click", () => {
        const metadata = { app_name: "mail", content_id: message.id, interaction_type: "dj_drop_request" };
        track("reply_or_contact_clicked", metadata);
        track("contact_link_clicked", metadata);
        track("dj_drop_request_clicked", metadata);
      });
    };
    renderInbox();
  }

  async function openExposure(host) {
    const data = await config();
    const invite = context();
    track("exposure_section_opened", { app_name: "camera", venue_id: "exposure" });
    track("venue_viewed", { app_name: "camera", venue_id: "exposure", content_title: "Exposure" });
    track("credential_status_viewed", {
      app_name: "camera", content_id: "exposure-credential",
      access_level: invite?.accessLevel
    });
    host.innerHTML = `<section class="dj-app dj-exposure-app">
      <header><span>EXPOSURE</span><b>${esc(data.label)}</b></header>
      <div class="dj-exposure-mark"><i></i><b></b><span>X</span></div>
      <p class="dj-credential-recognized">CREDENTIAL RECOGNIZED</p>
      <h2>${esc(invite?.accessLevel || "ALL ACCESS")}</h2>
      <p>Future Exposure previews, private performances, and industry events will appear here.</p>
      <div class="dj-exposure-status"><span>STATUS</span><strong>NO ACTIVE EVENT</strong><small>Your credential remains active for future approved access.</small></div>
    </section>`;
  }

  async function openSettings(host) {
    const data = await config();
    const invite = context();
    track("credential_status_viewed", {
      app_name: "settings", content_id: "dj-credential",
      access_level: invite?.accessLevel
    });
    const issuedAt = invite?.issuedAt
      ? new Date(invite.issuedAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
      : "Issued by Ghosts In Shells";
    host.innerHTML = `<section class="dj-app dj-settings-app">
      <header class="dj-app-kicker"><span>CREDENTIAL</span><b>${esc(data.label)}</b></header>
      <div class="dj-credential-card">
        <span class="dj-credential-issuer">GHOSTS IN SHELLS</span>
        <div class="dj-credential-seal">×</div>
        <p>Credential Holder<strong>${esc(invite?.recipientDisplayName || "Authorized DJ")}</strong></p>
        <dl>
          <div><dt>Access Type</dt><dd>${esc(invite?.accessType || "DJ")}</dd></div>
          <div><dt>Access Level</dt><dd>${esc(invite?.accessLevel || "All Access")}</dd></div>
          <div><dt>Status</dt><dd class="active">Active</dd></div>
          <div><dt>Issuer</dt><dd>${esc(data.issuer)}</dd></div>
          <div><dt>Issue Date</dt><dd>${esc(issuedAt)}</dd></div>
          <div><dt>Pass Number</dt><dd>${esc(invite?.publicPassNumber || "VERIFIED")}</dd></div>
        </dl>
      </div>
      <div class="dj-settings-note"><strong>Credential Security</strong><p>This screen never displays the invite token, token hash, signed context, database identifiers, or administrative credentials.</p></div>
    </section>`;
  }

  async function openApp(appId, host) {
    if (!isActive()) return false;
    activeHost = host;
    try {
      if (appId === "music") await openMusic(host);
      else if (appId === "photos") await openPhotos(host);
      else if (appId === "mail") await openMail(host);
      else if (appId === "stage") await openExposure(host);
      else if (appId === "settings") await openSettings(host);
      else return false;
    } catch (error) {
      host.innerHTML = `<p class="app-error">${esc(error.message)}</p>`;
    }
    document.getElementById("appWindow").scrollTop = 0;
    return true;
  }

  window.DJPhone = {
    isActive,
    openApp,
    configuration: null
  };
}());
