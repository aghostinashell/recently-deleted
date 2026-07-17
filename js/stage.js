"use strict";

(function () {
  const state = { event: null, notifications: [], messages: [], recordings: [] };
  let host = null;

  function escapeHtml(value) {
    const node = document.createElement("div");
    node.textContent = String(value ?? "");
    return node.innerHTML;
  }

  function upcomingConcert() {
    return (window.MyCalendar?.events || []).find((event) => event.type === "concert" && new Date(event.startsAt) > new Date());
  }

  function viewfinderContent(nextEvent) {
    if (state.event?.videoUrl) return `<video class="camera-live-video" src="${escapeHtml(state.event.videoUrl)}" autoplay controls playsinline></video>`;
    if (state.event?.isLive) return `<div class="camera-event-preview live-now"><span>● LIVE AT EXPOSURE</span><div class="exposure-mini-mark">X</div><h2>${escapeHtml(state.event.title)}</h2><p>The performance is live. Video will begin when the venue feed connects.</p></div>`;
    if (nextEvent) return `<div class="camera-event-preview"><span>UPCOMING PERFORMANCE</span><div class="exposure-mini-mark">X</div><h2>${escapeHtml(nextEvent.title)}</h2><p>${new Date(nextEvent.startsAt).toLocaleString([], { dateStyle: "full", timeStyle: "short" })}</p><button type="button" data-camera-event="${escapeHtml(nextEvent.id)}">View event & RSVP</button></div>`;
    return `<div class="camera-error-screen"><div>!</div><span>CAMERA STATUS · 404</span><h2>No Events Scheduled</h2><p>Exposure is currently offline. Check myCalendar for upcoming performances and releases.</p><button type="button" data-open-calendar>Check myCalendar</button></div>`;
  }

  function render() {
    if (!host) return;
    const nextEvent = upcomingConcert();
    const isLive = Boolean(state.event?.videoUrl || state.event?.isLive);

    host.innerHTML = `<div class="camera-app">
      <section class="camera-viewfinder" aria-label="Exposure live event camera">
        <div class="camera-top-controls"><span class="camera-format">LIVE <small>4K</small></span><span class="camera-privacy-dot"></span><span class="camera-tools">⌁ &nbsp; ◉ &nbsp; ⠿</span></div>
        <aside class="exposure-rail" aria-label="Exposure venue"><span class="exposure-x"><i></i><b></b></span><strong>EXPOSURE</strong></aside>
        <div class="camera-screen-frame"><i class="focus-corner tl"></i><i class="focus-corner tr"></i><i class="focus-corner bl"></i><i class="focus-corner br"></i>${viewfinderContent(nextEvent)}</div>
      </section>

      <section class="camera-controls">
        <div class="camera-zoom"><span>.5</span><strong>1×</strong><span>2</span><span>4</span><span>8</span></div>
        <button class="camera-record${isLive ? " recording" : ""}" type="button" aria-label="${isLive ? "Live event recording" : "No live event"}"><i></i></button>
        <div class="camera-bottom-row">
          <button class="camera-library" type="button" data-camera-library aria-label="Previous event videos"><span>▶</span></button>
          <div class="camera-modes"><span>VIDEO</span><strong>LIVE</strong></div>
          <button class="camera-switch" type="button" aria-label="Switch camera">↻</button>
        </div>
      </section>
    </div>`;

    host.querySelector("[data-camera-event]")?.addEventListener("click", (event) => {
      const eventId = event.currentTarget.dataset.cameraEvent;
      document.querySelector('[data-app-id="calendar"]')?.click();
      window.setTimeout(() => window.MyCalendar?.openEvent(eventId), 50);
    });
    host.querySelector("[data-open-calendar]")?.addEventListener("click", () => document.querySelector('[data-app-id="calendar"]')?.click());
    host.querySelector("[data-camera-library]")?.addEventListener("click", openLibrary);
  }

  function openLibrary() {
    const overlay = document.createElement("div");
    overlay.className = "camera-library-overlay";
    const recordings = state.recordings.length
      ? state.recordings.map((video) => `<button type="button" data-recording-src="${escapeHtml(video.src)}"><span>▶</span><strong>${escapeHtml(video.title)}</strong><small>${escapeHtml(video.date || "Previous event")}</small></button>`).join("")
      : `<div class="camera-library-empty"><span>▣</span><h3>No Previous Events</h3><p>Recordings from Exposure will appear here after each performance.</p></div>`;
    overlay.innerHTML = `<section><header><div><span>EXPOSURE ARCHIVE</span><h2>Previous Events</h2></div><button type="button" data-close-library>×</button></header><div class="camera-recording-grid">${recordings}</div></section>`;
    host.appendChild(overlay);
    overlay.querySelector("[data-close-library]").addEventListener("click", () => overlay.remove());
    overlay.addEventListener("click", (event) => { if (event.target === overlay) overlay.remove(); });
  }

  function open(element) { host = element; render(); }
  function setEvent(event) { state.event = event || null; render(); }
  function addRecording(recording) { state.recordings.unshift(recording); render(); }
  function notify(notification) {
    const item = { id: notification.id || crypto.randomUUID?.() || String(Date.now()), source: notification.source || "myPhone", message: notification.message || "New notification", type: notification.type || "site", createdAt: notification.createdAt || new Date().toISOString() };
    state.notifications.unshift(item);
    window.dispatchEvent(new CustomEvent("myphone:notification", { detail: item }));
  }
  function receiveMessage(message) {
    const item = { ...message, createdAt: message.createdAt || new Date().toISOString() };
    state.messages.push(item);
    window.dispatchEvent(new CustomEvent("myphone:message", { detail: item }));
  }

  window.MyStage = { open, setEvent, addRecording, notify, receiveMessage, state };
  window.MyCamera = window.MyStage;
  window.MyPhoneNotifications = { send: notify };
}());
