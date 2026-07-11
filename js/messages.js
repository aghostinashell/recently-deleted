"use strict";

(function createConnectedApps() {
  const DATA_URL = "data/messages/amber.json";
  const READ_KEY = "myphone.messages.amber.read";
  let dataPromise = null;

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
    const data = await getData();
    host.innerHTML = `
      <section class="photos-library">
        <header><h2>Library</h2><span>${data.photos.length} Photos</span></header>
        <div class="photos-grid">
          ${data.photos.map((photo) => `<button type="button" data-photo-src="${escapeHtml(photo.src)}"><img src="${escapeHtml(photo.src)}" alt="${escapeHtml(photo.caption)}"></button>`).join("")}
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
    host.innerHTML = `
      <section class="maps-view">
        <div class="maps-canvas"><span class="map-road road-one"></span><span class="map-road road-two"></span><i class="map-pin"></i></div>
        <article class="map-place-card">
          <p>SHARED LOCATION</p><h2>${escapeHtml(location.name)}</h2><span>${escapeHtml(location.address)}</span>
          <small>${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}</small>
        </article>
      </section>`;
  }

  window.MyMessages = { openMessages, openPhotos, openMaps, syncUnreadBadge };
})();
