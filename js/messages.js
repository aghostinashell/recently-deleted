"use strict";

(function createConnectedApps() {
  const THREAD_URLS = ["data/messages/amber.json", "data/messages/naomi.json", "data/messages/chase-bank.json", "data/messages/selina.json", "data/messages/ghost-supply.json", "data/messages/fi-ent.json"];
  const DATA_URL = THREAD_URLS[0];
  const MUSIC_DATA_URL = "data/music/recently-deleted.json";
  const BADGE_ACKNOWLEDGED_KEY = "myphone.messages.badge-acknowledged";
  let dataPromise = null;
  let threadsPromise = null;
  let musicPromise = null;
  let mapInstance = null;
  let mapSearchMarker = null;
  let lastGeocodeRequestAt = 0;

  function escapeHtml(value) {
    const node = document.createElement("div");
    node.textContent = String(value ?? "");
    return node.innerHTML;
  }

  function displayMessageDate(value) {
    return String(value || "").replace(/^(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday),\s+/i, "");
  }

  function renderMessageText(value) {
    return escapeHtml(value)
      .replace(/(https:\/\/[^\s<]+)/g, '<a class="message-link" href="$1" target="_blank" rel="noopener noreferrer">$1</a>')
      .replace(/\n/g, "<br>");
  }

  function contactVisual(contact, className = "") {
    return contact.photo
      ? `<img class="${className}" src="${escapeHtml(contact.photo)}" alt="">`
      : `<span class="contact-initials ${className}" aria-hidden="true">${escapeHtml(contact.initials || contact.name.charAt(0))}</span>`;
  }

  function getData() {
    if (!dataPromise) {
      dataPromise = fetch(DATA_URL).then((response) => {
        if (!response.ok) throw new Error("Messages could not be loaded.");
        return response.json();
      });
    }
    return dataPromise;
  }

  function readKey(threadId) {
    return `myphone.messages.${threadId}.read`;
  }

  function isUnread(thread) {
    return thread.initiallyUnread !== false && localStorage.getItem(readKey(thread.threadId)) !== "1";
  }

  function getThreads() {
    if (!threadsPromise) {
      threadsPromise = Promise.all(THREAD_URLS.map((url) => fetch(url).then((response) => {
        if (!response.ok) throw new Error("Messages could not be loaded.");
        return response.json();
      })));
    }
    return threadsPromise;
  }

  function getMusicData() {
    if (!musicPromise) {
      musicPromise = fetch(MUSIC_DATA_URL).then((response) => {
        if (!response.ok) throw new Error("Album artwork could not be loaded.");
        return response.json();
      });
    }
    return musicPromise;
  }

  async function syncUnreadBadge() {
    try {
      const threads = await getThreads();
      const hasUnread = localStorage.getItem(BADGE_ACKNOWLEDGED_KEY) !== "1" && threads.some(isUnread);
      document.querySelectorAll("[data-messages-unread]").forEach((badge) => { badge.hidden = !hasUnread; });
    } catch { /* The app view will show the loading error if opened. */ }
  }

  function photoById(data, id) {
    return data.photos.find((photo) => photo.id === id);
  }

  function locationById(data, id) {
    return data.locations.find((location) => location.id === id);
  }

  function latestReceived(thread) {
    let currentDate = "";
    let latest = { timestamp: 0, time: "", message: thread.messages.at(-1) };

    thread.messages.forEach((message) => {
      if (message.date) currentDate = message.date;
      if (message.sender === "Ed" || message.sender === "You" || !currentDate) return;
      const timestamp = Date.parse(`${currentDate} ${message.time || "12:00 AM"}`);
      if (!Number.isNaN(timestamp) && timestamp >= latest.timestamp) {
        latest = { timestamp, time: message.time || latest.time, message };
      }
    });

    return latest;
  }

  async function openMessages(host) {
    host.innerHTML = `<p class="app-loading">Loading Messages…</p>`;
    try {
      const threads = [...await getThreads()].sort((a, b) => latestReceived(b).timestamp - latestReceived(a).timestamp);
      host.innerHTML = `
        <section class="messages-list-view">
          <div class="messages-list-heading"><h2>Messages</h2><button type="button" aria-label="Compose message">•••</button></div>
          ${threads.map((thread) => {
            const last = latestReceived(thread);
            return `<button class="message-thread-row" type="button" data-open-thread="${escapeHtml(thread.threadId)}">
              <span class="thread-unread-dot" ${isUnread(thread) ? "" : "hidden"}></span>
              ${contactVisual(thread.contact)}
              <span class="thread-summary"><strong>${escapeHtml(thread.contact.name)}</strong><small>${escapeHtml(last.time)}</small><p>${escapeHtml(last.message?.text || thread.preview || "")}</p></span>
              <span class="thread-chevron">›</span>
            </button>`;
          }).join("")}
        </section>`;
      syncUnreadBadge();
      host.querySelectorAll("[data-open-thread]").forEach((button) => button.addEventListener("click", () => {
        const thread = threads.find((item) => item.threadId === button.dataset.openThread);
        if (thread) openThread(host, thread);
      }));
    } catch (error) {
      host.innerHTML = `<p class="app-error">${escapeHtml(error.message)}</p>`;
    }
  }

  function renderAttachment(data, message) {
    if (message.type === "image") {
      const photo = photoById(data, message.photoId);
      return photo ? `<img class="message-photo" src="${escapeHtml(photo.src)}" alt="${escapeHtml(photo.caption)}">` : "";
    }
    if (message.type === "location") {
      const location = locationById(data, message.locationId);
      if (!location) return "";
      return `
        <button class="message-location-card" type="button" data-message-location="${escapeHtml(location.id)}">
          <span class="mini-map"><i></i><b></b></span>
          <strong>${escapeHtml(location.name)}</strong>
          <small>${escapeHtml(location.address)}</small>
        </button>`;
    }
    return "";
  }

  function openThread(host, data) {
    localStorage.setItem(readKey(data.threadId), "1");
    localStorage.setItem(BADGE_ACKNOWLEDGED_KEY, "1");
    syncUnreadBadge();
    host.innerHTML = `
      <section class="message-conversation">
        <header class="conversation-header">
          <button type="button" data-back-messages aria-label="Back to messages">‹</button>
          <div class="conversation-contact-glass">
            ${contactVisual(data.contact)}
            <strong>${escapeHtml(data.contact.name)}</strong>
          </div>
        </header>
        <div class="conversation-stream">
          ${data.systemNotice ? `<div class="message-system"><strong>${escapeHtml(data.systemNotice.title)}</strong><span>${escapeHtml(data.systemNotice.text)}</span></div>` : ""}
          ${data.messages.map((message) => {
            const outgoing = message.sender === "Ed" || message.sender === "You";
            if (message.type === "status") return `
              ${message.date ? `<div class="message-date">${escapeHtml(displayMessageDate(message.date))}${message.time ? ` · ${escapeHtml(message.time)}` : ""}</div>` : ""}
              <div class="message-status-event"><strong>${escapeHtml(message.status)}</strong>${message.note ? `<span>${escapeHtml(message.note)}</span>` : ""}</div>`;
            return `
              ${message.date ? `<div class="message-date">${escapeHtml(displayMessageDate(message.date))}${data.groupedTimestamps && message.time ? ` · ${escapeHtml(message.time)}` : ""}</div>` : ""}
              ${message.breakBefore ? `<div class="message-gap"></div>` : ""}
              <article class="message-item ${outgoing ? "outgoing" : "incoming"} ${data.platform === "android" && outgoing ? "android-message" : ""} ${data.threadStyle === "bank-alerts" ? "bank-message" : ""}">
                ${data.groupedTimestamps ? "" : `<time>${escapeHtml(message.time)}</time>`}
                <div class="message-bubble ${message.type !== "text" ? `has-${message.type}` : ""}">
                  ${renderAttachment(data, message)}
                  ${message.text ? `<p>${renderMessageText(message.text)}</p>` : ""}
                </div>
                ${outgoing && message.receipt ? `<small class="message-receipt">${escapeHtml(message.receipt)}</small>` : ""}
                ${message.status ? `<small class="message-receipt ${outgoing ? "" : "incoming-status"}">${escapeHtml(message.status)}</small>` : ""}
              </article>`;
          }).join("")}
        </div>
      </section>`;
    host.querySelector("[data-back-messages]").addEventListener("click", () => openMessages(host));
    host.querySelectorAll("[data-message-location]").forEach((button) => {
      button.addEventListener("click", () => openMaps(host, button.dataset.messageLocation));
    });
    const windowNode = document.getElementById("appWindow");
    windowNode.scrollTop = windowNode.scrollHeight;
  }

  async function openPhotos(host) {
    host.innerHTML = `<p class="app-loading">Loading Photos…</p>`;
    const [data, music] = await Promise.all([getData(), getMusicData()]);
    const uniqueTrackArtworkNumbers = new Set([1, 4, 10]);
    const albumPhotos = [
      { id: "album-cover", src: music.artwork, caption: `${music.album} — Album Cover` },
      ...music.tracks
        .filter((track) => uniqueTrackArtworkNumbers.has(track.number))
        .map((track) => ({ id: `track-${track.number}`, src: track.artwork, caption: `${track.number}. ${track.title}` }))
    ];
    const photos = [...data.photos, ...albumPhotos].filter((photo, index, list) => list.findIndex((item) => item.src === photo.src) === index);
    host.innerHTML = `
      <section class="photos-library">
        <header><h2>Library</h2><span>${photos.length} Photos</span></header>
        <div class="photos-grid">
          ${photos.map((photo) => `<button type="button" data-photo-src="${escapeHtml(photo.src)}" aria-label="View ${escapeHtml(photo.caption)}"><img src="${escapeHtml(photo.src)}" alt="${escapeHtml(photo.caption)}" draggable="false"></button>`).join("")}
        </div>
        <div class="photo-lightbox" hidden><button type="button" aria-label="Close photo">×</button><img alt=""></div>
      </section>`;
    const lightbox = host.querySelector(".photo-lightbox");
    host.querySelectorAll("[data-photo-src]").forEach((button) => button.addEventListener("click", () => {
      lightbox.querySelector("img").src = button.dataset.photoSrc;
      lightbox.hidden = false;
    }));
    lightbox.querySelector("button").addEventListener("click", () => { lightbox.hidden = true; });
  }

  async function openMaps(host, selectedId) {
    host.innerHTML = `<p class="app-loading">Loading Maps…</p>`;
    const data = await getData();
    const location = locationById(data, selectedId) || data.locations[0];
    if (!location) {
      host.innerHTML = `<p class="empty-state">No saved locations yet.</p>`;
      return;
    }
    host.innerHTML = `
      <section class="maps-view">
        <form class="maps-search" data-map-search>
          <span aria-hidden="true">⌕</span>
          <input type="search" name="address" placeholder="Search any address" aria-label="Search any address" autocomplete="street-address">
          <button type="submit">Search</button>
        </form>
        <div class="map-search-results" data-map-search-results hidden></div>
        <button class="maps-recenter" type="button" data-map-recenter aria-label="Return to saved location">⌖</button>
        <div class="maps-canvas" id="savedLocationsMap" aria-label="Interactive map of saved locations"></div>
        <h3 class="saved-places-heading">Saved Places</h3>
        <div class="saved-places-strip">
          ${data.locations.map((place) => `<button type="button" data-saved-place="${escapeHtml(place.id)}"><span>●</span><strong>${escapeHtml(place.name)}</strong><small>${escapeHtml(place.address)}</small></button>`).join("")}
        </div>
        <article class="map-place-card" data-map-place-card>
          <p>SAVED FROM MESSAGES</p><h2>${escapeHtml(location.name)}</h2><span>${escapeHtml(location.address)}</span>
          <small>${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}</small>
        </article>
      </section>`;

    if (!window.L) {
      host.querySelector(".maps-canvas").innerHTML = `<p class="app-error">The interactive map could not be loaded.</p>`;
      return;
    }

    mapInstance?.remove();
    mapInstance = window.L.map("savedLocationsMap", { zoomControl: false, attributionControl: true }).setView([location.latitude, location.longitude], 15);
    window.L.control.zoom({ position: "bottomright" }).addTo(mapInstance);
    window.L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(mapInstance);

    const pinIcon = window.L.divIcon({ className: "saved-map-pin-wrap", html: '<span class="saved-map-pin"><i></i></span>', iconSize: [38, 46], iconAnchor: [19, 43] });
    const searchPinIcon = window.L.divIcon({ className: "search-map-pin-wrap", html: '<span class="search-map-pin"><i></i></span>', iconSize: [34, 42], iconAnchor: [17, 39] });
    const markers = new Map();

    function selectPlace(place, pan = true) {
      const card = host.querySelector("[data-map-place-card]");
      card.innerHTML = `<p>SAVED FROM MESSAGES</p><h2>${escapeHtml(place.name)}</h2><span>${escapeHtml(place.address)}</span><small>${place.latitude.toFixed(5)}, ${place.longitude.toFixed(5)}</small>`;
      host.querySelectorAll("[data-saved-place]").forEach((button) => button.classList.toggle("active", button.dataset.savedPlace === place.id));
      if (pan) mapInstance.flyTo([place.latitude, place.longitude], 16, { duration: 0.75 });
      markers.get(place.id)?.openPopup();
    }

    data.locations.forEach((place) => {
      const marker = window.L.marker([place.latitude, place.longitude], { icon: pinIcon, title: place.name, alt: place.name })
        .addTo(mapInstance)
        .bindPopup(`<strong>${escapeHtml(place.name)}</strong><br><span>${escapeHtml(place.address)}</span>`);
      marker.on("click", () => selectPlace(place, false));
      markers.set(place.id, marker);
    });

    host.querySelectorAll("[data-saved-place]").forEach((button) => button.addEventListener("click", () => {
      const place = locationById(data, button.dataset.savedPlace);
      if (place) selectPlace(place);
    }));
    host.querySelector("[data-map-recenter]").addEventListener("click", () => selectPlace(location));
    host.querySelector("[data-map-search]").addEventListener("submit", async (event) => {
      event.preventDefault();
      const query = String(new FormData(event.currentTarget).get("address") || "").trim();
      if (query.length < 3) return;
      const resultsNode = host.querySelector("[data-map-search-results]");
      resultsNode.hidden = false;
      resultsNode.innerHTML = `<p>Searching…</p>`;
      try {
        const cacheKey = `myphone.map-search.${query.toLowerCase()}`;
        let results = null;
        try { results = JSON.parse(localStorage.getItem(cacheKey)); } catch { /* Fetch below. */ }
        if (!Array.isArray(results)) {
          const wait = Math.max(0, 1100 - (Date.now() - lastGeocodeRequestAt));
          if (wait) await new Promise((resolve) => window.setTimeout(resolve, wait));
          lastGeocodeRequestAt = Date.now();
          const searchUrl = new URL("https://nominatim.openstreetmap.org/search");
          searchUrl.search = new URLSearchParams({ q: query, format: "jsonv2", addressdetails: "1", limit: "5" });
          const response = await fetch(searchUrl, { headers: { Accept: "application/json" } });
          if (!response.ok) throw new Error("Address search is temporarily unavailable.");
          results = await response.json();
          localStorage.setItem(cacheKey, JSON.stringify(results));
        }
        resultsNode.innerHTML = results.length ? results.map((result, index) => `<button type="button" data-map-result="${index}"><strong>${escapeHtml(result.name || result.display_name.split(",")[0])}</strong><small>${escapeHtml(result.display_name)}</small></button>`).join("") : `<p>No matching addresses found.</p>`;
        resultsNode.querySelectorAll("[data-map-result]").forEach((button) => button.addEventListener("click", () => {
          const result = results[Number(button.dataset.mapResult)];
          const latitude = Number(result.lat);
          const longitude = Number(result.lon);
          if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
          mapSearchMarker?.remove();
          mapSearchMarker = window.L.marker([latitude, longitude], { icon: searchPinIcon, title: result.display_name }).addTo(mapInstance);
          mapSearchMarker.bindPopup(`<strong>${escapeHtml(result.name || result.display_name.split(",")[0])}</strong><br><span>${escapeHtml(result.display_name)}</span>`).openPopup();
          mapInstance.flyTo([latitude, longitude], 16, { duration: .75 });
          host.querySelector("[data-map-place-card]").innerHTML = `<p>SEARCH RESULT · NOT SAVED</p><h2>${escapeHtml(result.name || result.display_name.split(",")[0])}</h2><span>${escapeHtml(result.display_name)}</span><small>${latitude.toFixed(5)}, ${longitude.toFixed(5)}</small>`;
          resultsNode.hidden = true;
        }));
      } catch (error) {
        resultsNode.innerHTML = `<p>${escapeHtml(error.message)}</p>`;
      }
    });
    selectPlace(location, false);
    window.setTimeout(() => mapInstance?.invalidateSize(), 80);
  }

  window.MyMessages = { openMessages, openPhotos, openMaps, syncUnreadBadge };
})();
