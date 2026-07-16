"use strict";

(function () {
  const events = [];
  let host = null;
  let visibleMonth = new Date();
  const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const eventsFor = (date) => events.filter((event) => sameDay(new Date(event.startsAt), date));

  function render() {
    if (!host) return;
    const year = visibleMonth.getFullYear();
    const month = visibleMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const count = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    const cells = Array.from({ length: firstDay }, () => `<span class="calendar-day blank"></span>`);
    for (let day = 1; day <= count; day += 1) {
      const date = new Date(year, month, day);
      const dayEvents = eventsFor(date);
      cells.push(`<button class="calendar-day${sameDay(date, today) ? " today" : ""}${dayEvents.length ? " has-event" : ""}" type="button" data-calendar-date="${date.toISOString()}"><span>${day}</span>${dayEvents.length ? `<i aria-label="Event scheduled"></i>` : ""}</button>`);
    }
    host.innerHTML = `<div class="planner-shell">
      <header class="planner-header"><div><span>PLANNER</span><h2>${visibleMonth.toLocaleDateString([], { month: "long", year: "numeric" })}</h2></div><div class="planner-nav"><button type="button" data-calendar-nav="-1" aria-label="Previous month">‹</button><button type="button" data-calendar-nav="1" aria-label="Next month">›</button></div></header>
      <div class="planner-weekdays">${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => `<span>${day}</span>`).join("")}</div>
      <div class="planner-grid">${cells.join("")}</div>
      <section class="planner-agenda"><h3>Upcoming</h3><p>${events.length ? `${events.length} scheduled event${events.length === 1 ? "" : "s"}` : "No events scheduled yet."}</p></section>
    </div>`;
    host.querySelectorAll("[data-calendar-nav]").forEach((button) => button.addEventListener("click", () => { visibleMonth = new Date(year, month + Number(button.dataset.calendarNav), 1); render(); }));
    host.querySelectorAll("[data-calendar-date]").forEach((button) => button.addEventListener("click", () => openDate(new Date(button.dataset.calendarDate))));
  }

  function openDate(date) {
    const dayEvents = eventsFor(date);
    if (!dayEvents.length) return;
    const event = dayEvents[0];
    const until = new Date(event.startsAt).getTime() - Date.now();
    if (until <= 600000 && until > -Math.max(event.durationMinutes || 120, 10) * 60000) {
      window.MyStage?.setEvent(event);
      document.querySelector('[data-app-id="stage"]')?.click();
      return;
    }
    host.innerHTML = `<article class="event-detail"><button type="button" class="event-back" id="eventBack">‹ Calendar</button><span>UPCOMING EVENT</span><h2>${event.title}</h2><p>${new Date(event.startsAt).toLocaleString([], { dateStyle: "full", timeStyle: "short" })}</p><button type="button" class="event-reserve" id="eventReserve">${event.ticketUrl ? "Purchase tickets" : "Reserve"}</button></article>`;
    document.getElementById("eventBack").addEventListener("click", render);
    document.getElementById("eventReserve").addEventListener("click", () => event.ticketUrl ? window.open(event.ticketUrl, "_blank", "noopener") : window.dispatchEvent(new CustomEvent("myphone:reserve", { detail: event })));
  }

  function open(element) { host = element; render(); }
  function addEvent(event) { events.push(event); events.sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt)); render(); }
  window.MyCalendar = { open, addEvent, events };
}());
