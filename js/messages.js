"use strict";

(function createConnectedApps() {
  const DATA_URL = "data/messages/amber.json";
  const MUSIC_DATA_URL = "data/music/recently-deleted.json";
  const READ_KEY = "myphone.messages.amber.read";
  let dataPromise = null;
  let musicPromise = null;
  let mapInstance = null;

  function escapeHtml(value) {
    const node = document.createElement("div");
    node.textContent = String(value ?? "");
    return node.innerHTML;
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

  function isUnread() {
    return localStorage.getItem(READ_KEY) !== "1";
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

  function syncUnreadBadge() {
    document.querySelectorAll("[data-messages-unread]").forEach((badge) => {
      badge.hidden = !isUnread();
    });
  }

  function photoById(data, id) {
    return data.photos.find((photo) => photo.id === id);
  }

  function locationById(data, id) {
    return data.locations.find((location) => location.id === id);
  }

  async function openMessages(host) {
    host.innerHTML = `<p class="app-loading">Loading Messages…</p>`;
    try {
      const data = await getData();
      const last = data.messages[data.messages.length - 1];
      host.innerHTML = `
        <section class="messages-list-view">
          <div class="messages-list-heading"><h2>Messages</h2><button type="button" aria-label="Compose message">•••</button></div>
          <button class="message-thread-row" type="button" data-open-amber>
            <span class="thread-unread-dot" data-messages-unread></span>
            <img src="${escapeHtml(data.contact.photo)}" alt="">
            <span class="thread-summary">
              <strong>${escapeHtml(data.contact.name)}</strong>
              <small>${escapeHtml(last.time)}</small>
              <p>${escapeHtml(last.text)}</p>
            </span>
            <span class="thread-chevron">›</span>
          </button>
        </section>`;
      syncUnreadBadge();
      host.querySelector("[data-open-amber]").addEventListener("click", () => openThread(host, data));
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
    localStorage.setItem(READ_KEY, "1");
    syncUnreadBadge();
    host.innerHTML = `
      <section class="message-conversation">
        <header class="conversation-header">
          <button type="button" data-back-messages aria-label="Back to messages">‹</button>
          <div class="conversation-contact-glass">
            <img src="${escapeHtml(data.contact.photo)}" alt="${escapeHtml(data.contact.name)}">
            <strong>${escapeHtml(data.contact.name)}</strong>
          </div>
        </header>
        <div class="conversation-stream">
          ${data.messages.map((message) => {
            const outgoing = message.sender === "Ed";
            return `
              ${message.date ? `<div class="message-date">${escapeHtml(message.date)}</div>` : ""}
              ${message.breakBefore ? `<div class="message-gap"></div>` : ""}
              <article class="message-item ${outgoing ? "outgoing" : "incoming"}">
                <time>${escapeHtml(message.time)}</time>
                <div class="message-bubble ${message.type !== "text" ? `has-${message.type}` : ""}">
                  ${renderAttachment(data, message)}
                  ${message.text ? `<p>${escapeHtml(message.text).replace(/\n/g, "<br>")}</p>` : ""}
                </div>
                ${outgoing && message.receipt ? `<small class="message-receipt">${escapeHtml(message.receipt)}</small>` : ""}
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
        <div class="maps-toolbar"><strong>Saved Places</strong><button type="button" data-map-recenter aria-label="Recenter map">⌖</button></div>
        <div class="maps-canvas" id="savedLocationsMap" aria-label="Interactive map of saved locations"></div>
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
    selectPlace(location, false);
    window.setTimeout(() => mapInstance?.invalidateSize(), 80);
  }

  window.MyMessages = { openMessages, openPhotos, openMaps, syncUnreadBadge };
})();
