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
    const upcomingEvents = (window.MyCalendar?.events || []).filter((event) => event.type === "concert" && new Date(event.startsAt) > new Date());
    const nextEvent = upcomingEvents[0];
    const items = state.notifications.length
      ? state.notifications.map((item) => `<li class="stage-notification"><span>${escapeHtml(item.source || "myPhone")}</span><p>${escapeHtml(item.message)}</p></li>`).join("")
      : `<li class="stage-empty-note">Site notifications will appear here during live events.</li>`;

    host.innerHTML = `<div class="stage-shell">
      <section class="stage-view" aria-label="Live event stage">
        <div class="stage-curtain stage-curtain-left"></div><div class="stage-curtain stage-curtain-right"></div>
        <div class="stage-center">${state.event?.videoUrl
          ? `<video class="stage-video" src="${escapeHtml(state.event.videoUrl)}" controls playsinline></video>`
          : nextEvent
            ? `<span class="stage-live-mark">Upcoming at myStage</span><h2>${escapeHtml(nextEvent.title)}</h2><p>${new Date(nextEvent.startsAt).toLocaleString([], { dateStyle: "full", timeStyle: "short" })}</p><button class="stage-calendar-link" type="button" data-stage-event="${escapeHtml(nextEvent.id)}">View event & RSVP</button>`
            : `<div class="stage-error-icon">!</div><span class="stage-error-code">NO EVENTS</span><h2>No Events Scheduled</h2><p>There are no performances scheduled at this time. Check myCalendar for upcoming events and releases.</p><button class="stage-calendar-link" type="button" data-open-calendar>Check myCalendar</button>`}</div>
      </section>
      <section class="stage-feed"><div class="stage-section-heading"><h3>Live notifications</h3><span>${state.notifications.length}</span></div><ul class="stage-notification-list">${items}</ul></section>
    </div>`;
    host.querySelector("[data-stage-event]")?.addEventListener("click", (clickEvent) => {
      const eventId = clickEvent.currentTarget.dataset.stageEvent;
      document.querySelector('[data-app-id="calendar"]')?.click();
      window.setTimeout(() => window.MyCalendar?.openEvent(eventId), 50);
    });
    host.querySelector("[data-open-calendar]")?.addEventListener("click", () => document.querySelector('[data-app-id="calendar"]')?.click());
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
