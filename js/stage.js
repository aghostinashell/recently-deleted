"use strict";

(function () {
  const state = { event: null, notifications: [], messages: [] };
  let host = null;

  function escapeHtml(value) {
    const node = document.createElement("div");
    node.textContent = String(value ?? "");
    return node.innerHTML;
  }

  function render() {
    if (!host) return;
    const items = state.notifications.length
      ? state.notifications.map((item) => `<li class="stage-notification"><span>${escapeHtml(item.source || "myPhone")}</span><p>${escapeHtml(item.message)}</p></li>`).join("")
      : `<li class="stage-empty-note">Site notifications will appear here during live events.</li>`;

    host.innerHTML = `<div class="stage-shell">
      <section class="stage-view" aria-label="Live event stage">
        <div class="stage-curtain stage-curtain-left"></div><div class="stage-curtain stage-curtain-right"></div>
        <div class="stage-center">${state.event?.videoUrl
          ? `<video class="stage-video" src="${escapeHtml(state.event.videoUrl)}" controls playsinline></video>`
          : `<span class="stage-live-mark">myStage</span><h2>No Live Events</h2><p>Check the calendar for upcoming shows.</p>`}</div>
      </section>
      <section class="stage-feed"><div class="stage-section-heading"><h3>Live notifications</h3><span>${state.notifications.length}</span></div><ul class="stage-notification-list">${items}</ul></section>
    </div>`;
  }

  function open(element) { host = element; render(); }
  function setEvent(event) { state.event = event || null; render(); }
  function notify(notification) {
    const item = { id: notification.id || crypto.randomUUID?.() || String(Date.now()), source: notification.source || "myPhone", message: notification.message || "New notification", type: notification.type || "site", createdAt: notification.createdAt || new Date().toISOString() };
    state.notifications.unshift(item);
    window.dispatchEvent(new CustomEvent("myphone:notification", { detail: item }));
    render();
  }
  function receiveMessage(message) {
    const item = { ...message, createdAt: message.createdAt || new Date().toISOString() };
    state.messages.push(item);
    window.dispatchEvent(new CustomEvent("myphone:message", { detail: item }));
  }

  window.MyStage = { open, setEvent, notify, receiveMessage, state };
  window.MyPhoneNotifications = { send: notify };
}());
