"use strict";

(function createMusicApp() {
  const DATA_URL = "data/music/recently-deleted.json";
  const audio = new Audio();
  audio.preload = "metadata";
  audio.playsInline = true;

  let albumData = null;
  let currentIndex = -1;
  let host = null;
  let loadError = "";
  let activeView = "album";
  let shuffle = false;
  let repeatMode = 0;
  let lyricsText = "";
  let showLyrics = false;

  function escapeHtml(value) {
    const node = document.createElement("div");
    node.textContent = String(value ?? "");
    return node.innerHTML;
  }

  function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
    const minutes = Math.floor(seconds / 60);
    return `${minutes}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
  }

  async function getAlbum() {
    if (albumData) return albumData;
    const response = await fetch(DATA_URL);
    if (!response.ok) throw new Error(`Album data could not be loaded (${response.status}).`);
    albumData = await response.json();
    if (!Array.isArray(albumData.tracks)) albumData.tracks = [];
    return albumData;
  }

  function currentTrack() {
    return albumData?.tracks?.[currentIndex] || null;
  }

  function albumView() {
    return `
      <div class="music-view">
        <button class="music-album-card" type="button" data-music-action="open-album">
          <span class="music-artwork-wrap">
            <img class="music-artwork" src="${escapeHtml(albumData.artwork || albumData.tracks[0]?.artwork || "")}" alt="${escapeHtml(albumData.album)} artwork">
            <span class="music-artwork-fallback" aria-hidden="true">♪</span>
          </span>
          <span class="music-album-title">${escapeHtml(albumData.album)}</span>
          <span class="music-album-artist">${escapeHtml(albumData.artist)}</span>
        </button>
        <div class="music-album-actions">
          <button type="button" data-music-action="play-album"><span aria-hidden="true">▶</span> Play</button>
          <button type="button" data-music-action="shuffle-album"><span aria-hidden="true">⤨</span> Shuffle</button>
        </div>
        ${loadError ? `<p class="app-error">${escapeHtml(loadError)}</p>` : ""}
      </div>`;
  }

  function trackListView() {
    const tracks = albumData.tracks.map((track, index) => `
      <button class="music-track-row${index === currentIndex ? " current" : ""}" type="button" data-track-index="${index}" aria-label="Play ${escapeHtml(track.title)}">
        <span class="music-track-number">${index === currentIndex && !audio.paused ? '<i class="music-equalizer" aria-hidden="true"><b></b><b></b><b></b></i>' : escapeHtml(track.number)}</span>
        <span class="music-track-copy">
          <strong>${escapeHtml(track.title)}</strong>
          <small>${escapeHtml(track.artist || albumData.artist)}</small>
        </span>
        <span class="music-track-play" aria-hidden="true">▶</span>
      </button>`).join("");

    return `
      <div class="music-view">
        <button class="app-back-button" type="button" data-music-action="back">‹ Music</button>
        <div class="music-album-header">
          <span class="music-artwork-wrap small">
            <img class="music-artwork" src="${escapeHtml(albumData.artwork || albumData.tracks[0]?.artwork || "")}" alt="${escapeHtml(albumData.album)} artwork">
            <span class="music-artwork-fallback" aria-hidden="true">♪</span>
          </span>
          <div><h2>${escapeHtml(albumData.album)}</h2><p>${escapeHtml(albumData.artist)}</p></div>
        </div>
        <div class="music-list-actions">
          <button type="button" data-music-action="play-album">▶ Play</button>
          <button type="button" data-music-action="shuffle-album">⤨ Shuffle</button>
        </div>
        <div class="music-track-list">${tracks || `<p class="empty-state">No tracks are available.</p>`}</div>
      </div>`;
  }

  function playerView() {
    const track = currentTrack();
    if (!track) return trackListView();
    return `
      <div class="music-player-view">
        <button class="app-back-button" type="button" data-music-action="track-list">‹ ${escapeHtml(albumData.album)}</button>
        <span class="player-artwork-wrap${audio.paused ? " paused" : ""}">
          <img class="player-artwork" src="${escapeHtml(track.artwork)}" alt="${escapeHtml(track.title)} artwork">
          <span class="player-artwork-fallback" aria-hidden="true">♪</span>
        </span>
        <div class="player-meta"><div><h2>${escapeHtml(track.title)}</h2><p>${escapeHtml(track.artist || albumData.artist)}</p></div><button type="button" data-music-action="track-list" aria-label="Show track list">•••</button></div>
        <input class="music-seek" data-music-seek type="range" min="0" max="100" value="0" step="0.1" aria-label="Seek through track" style="--progress:0%">
        <div class="music-time"><span data-music-elapsed>0:00</span><span data-music-duration>0:00</span></div>
        <div class="music-controls">
          <button type="button" data-music-action="previous" aria-label="Previous track">|◀</button>
          <button class="music-play-button" type="button" data-music-action="toggle" aria-label="Play"><span data-music-play-icon>▶</span></button>
          <button type="button" data-music-action="next" aria-label="Next track">▶|</button>
        </div>
        <div class="music-secondary-controls">
          <button class="${shuffle ? "active" : ""}" type="button" data-music-action="shuffle" aria-label="${shuffle ? "Turn shuffle off" : "Turn shuffle on"}">⤨</button>
          <label class="music-volume"><span aria-hidden="true">◖</span><input data-music-volume type="range" min="0" max="1" value="${audio.volume}" step="0.05" aria-label="Volume"><span aria-hidden="true">◗</span></label>
          <button class="${repeatMode ? "active" : ""}" type="button" data-music-action="repeat" aria-label="Repeat ${repeatMode === 1 ? "all" : repeatMode === 2 ? "one" : "off"}">${repeatMode === 2 ? "↻¹" : "↻"}</button>
        </div>
        ${track.lyrics ? `<button class="music-lyrics-toggle" type="button" data-music-action="lyrics">${showLyrics ? "Hide Lyrics" : "Show Lyrics"}</button>` : ""}
        ${showLyrics ? `<section class="music-lyrics" aria-label="Lyrics"><h3>Lyrics</h3><p>${lyricsText ? escapeHtml(lyricsText) : "Loading lyrics…"}</p></section>` : ""}
        <p class="app-error" data-music-error>${escapeHtml(loadError)}</p>
      </div>`;
  }

  function bindArtworkFallbacks() {
    host?.querySelectorAll(".music-artwork, .player-artwork").forEach((image) => {
      image.addEventListener("error", () => image.classList.add("missing"), { once: true });
      if (image.complete && image.naturalWidth === 0) image.classList.add("missing");
    });
  }

  function render(view) {
    if (!host) return;
    host.innerHTML = view;
    bindArtworkFallbacks();
    host.querySelectorAll("[data-music-action]").forEach((button) => {
      button.addEventListener("click", () => handleAction(button.dataset.musicAction));
    });
    host.querySelectorAll("[data-track-index]").forEach((button) => {
      button.addEventListener("click", () => playTrack(Number(button.dataset.trackIndex)));
    });
    host.querySelector("[data-music-seek]")?.addEventListener("input", (event) => {
      if (Number.isFinite(audio.duration)) audio.currentTime = (Number(event.target.value) / 100) * audio.duration;
    });
    host.querySelector("[data-music-volume]")?.addEventListener("input", (event) => {
      audio.volume = Number(event.target.value);
    });
    updatePlayerUI();
  }

  function setError(message) {
    loadError = message;
    const error = host?.querySelector("[data-music-error]");
    if (error) error.textContent = message;
  }

  async function playTrack(index) {
    const tracks = albumData?.tracks || [];
    if (!tracks.length) return;
    currentIndex = (index + tracks.length) % tracks.length;
    const track = currentTrack();
    loadError = "";
    audio.src = track.audio;
    updateMediaSession(track);
    lyricsText = "";
    showLyrics = false;
    activeView = "player";
    render(playerView());
    try {
      await audio.play();
    } catch (error) {
      if (error.name !== "AbortError" && error.name !== "NotAllowedError") {
        setError("This audio file could not be played.");
      }
    }
    updatePlayerUI();
  }

  function handleAction(action) {
    if (action === "open-album") { activeView = "list"; render(trackListView()); }
    if (action === "back") { activeView = "album"; render(albumView()); }
    if (action === "track-list") { activeView = "list"; render(trackListView()); }
    if (action === "play-album") { shuffle = false; playTrack(0); }
    if (action === "shuffle-album") { shuffle = true; playTrack(Math.floor(Math.random() * albumData.tracks.length)); }
    if (action === "toggle") {
      if (!currentTrack() && albumData.tracks.length) return playTrack(0);
      if (audio.paused) audio.play().catch((error) => {
        if (error.name !== "NotAllowedError") setError("This audio file could not be played.");
      });
      else audio.pause();
    }
    if (action === "previous") {
      if (audio.currentTime > 3) { audio.currentTime = 0; return; }
      playTrack(currentIndex <= 0 ? albumData.tracks.length - 1 : currentIndex - 1);
    }
    if (action === "next") playTrack(nextIndex());
    if (action === "shuffle") { shuffle = !shuffle; render(playerView()); }
    if (action === "repeat") { repeatMode = (repeatMode + 1) % 3; render(playerView()); }
    if (action === "lyrics") toggleLyrics();
  }

  function nextIndex() {
    if (!shuffle || albumData.tracks.length < 2) return (currentIndex + 1) % albumData.tracks.length;
    let next = currentIndex;
    while (next === currentIndex) next = Math.floor(Math.random() * albumData.tracks.length);
    return next;
  }

  function updateMediaSession(track) {
    if (!("mediaSession" in navigator) || !("MediaMetadata" in window)) return;
    navigator.mediaSession.metadata = new window.MediaMetadata({
      title: track.title,
      artist: track.artist || albumData.artist,
      album: albumData.album,
      artwork: [
        { src: new URL(track.artwork, window.location.href).href, sizes: "512x512", type: "image/jpeg" }
      ]
    });
  }

  function updateMediaPosition() {
    if (!("mediaSession" in navigator) || !Number.isFinite(audio.duration) || audio.duration <= 0) return;
    try {
      navigator.mediaSession.setPositionState({
        duration: audio.duration,
        playbackRate: audio.playbackRate,
        position: Math.min(audio.currentTime, audio.duration)
      });
    } catch { /* Position controls are optional across browsers. */ }
  }

  async function toggleLyrics() {
    showLyrics = !showLyrics;
    render(playerView());
    const track = currentTrack();
    if (showLyrics && !lyricsText && track?.lyrics) {
      try {
        const response = await fetch(track.lyrics);
        if (response.ok) {
          const noteText = await response.text();
          lyricsText = noteText.replace(/^.*?Last saved:?.*?(?:\r?\n)+/i, "").trim();
        } else {
          lyricsText = "Lyrics aren’t available for this track yet.";
        }
      } catch { lyricsText = "Lyrics aren’t available for this track yet."; }
      if (activeView === "player" && showLyrics) render(playerView());
    }
  }

  function updatePlayerUI() {
    const seek = host?.querySelector("[data-music-seek]");
    const progress = Number.isFinite(audio.duration) && audio.duration > 0 ? (audio.currentTime / audio.duration) * 100 : 0;
    if (seek) { seek.value = String(progress); seek.style.setProperty("--progress", `${progress}%`); }
    const elapsed = host?.querySelector("[data-music-elapsed]");
    const duration = host?.querySelector("[data-music-duration]");
    const icon = host?.querySelector("[data-music-play-icon]");
    const toggle = host?.querySelector('[data-music-action="toggle"]');
    if (elapsed) elapsed.textContent = formatTime(audio.currentTime);
    if (duration) duration.textContent = formatTime(audio.duration);
    if (icon) icon.textContent = audio.paused ? "▶" : "Ⅱ";
    if (toggle) toggle.setAttribute("aria-label", audio.paused ? "Play" : "Pause");
    host?.querySelector(".player-artwork-wrap")?.classList.toggle("paused", audio.paused);
    if ("mediaSession" in navigator) navigator.mediaSession.playbackState = audio.paused ? "paused" : "playing";
    updateMediaPosition();
  }

  if ("mediaSession" in navigator) {
    const setMediaAction = (action, handler) => {
      try { navigator.mediaSession.setActionHandler(action, handler); } catch { /* Unsupported action. */ }
    };
    setMediaAction("play", () => audio.play());
    setMediaAction("pause", () => audio.pause());
    setMediaAction("previoustrack", () => {
      if (audio.currentTime > 3) audio.currentTime = 0;
      else playTrack(currentIndex <= 0 ? albumData.tracks.length - 1 : currentIndex - 1);
    });
    setMediaAction("nexttrack", () => playTrack(nextIndex()));
    setMediaAction("seekbackward", (details) => {
      audio.currentTime = Math.max(0, audio.currentTime - (details.seekOffset || 10));
    });
    setMediaAction("seekforward", (details) => {
      audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + (details.seekOffset || 10));
    });
    setMediaAction("seekto", (details) => {
      if (Number.isFinite(details.seekTime)) audio.currentTime = details.seekTime;
    });
  }

  ["timeupdate", "loadedmetadata", "play", "pause"].forEach((eventName) => audio.addEventListener(eventName, updatePlayerUI));
  audio.addEventListener("ended", () => {
    if (repeatMode === 2) { audio.currentTime = 0; audio.play(); }
    else if (albumData?.tracks?.length > 1 && (repeatMode === 1 || currentIndex < albumData.tracks.length - 1 || shuffle)) playTrack(nextIndex());
    else updatePlayerUI();
  });
  audio.addEventListener("error", () => setError("The audio file is missing or unavailable."));

  window.MyMusic = {
    async open(container) {
      host = container;
      host.innerHTML = `<p class="app-loading">Loading music…</p>`;
      try {
        await getAlbum();
        render(currentTrack() ? playerView() : albumView());
      } catch (error) {
        host.innerHTML = `<p class="app-error">Music could not be loaded. ${escapeHtml(error.message)}</p>`;
      }
    }
  };
})();
