"use strict";

(function () {
  const events = [
    {
      id: "recently-deleted-release",
      type: "release",
      title: "Recently Deleted",
      subtitle: "Official album release",
      startsAt: "2026-08-04T00:00:00-04:00",
      platforms: ["Apple Music", "Spotify", "YouTube", "Amazon Music"]
    },
    {
      id: "eds-25th-birthday-concert",
      type: "concert",
      title: "Recently Deleted: Live at myStage Concert Venue",
      subtitle: "Ed’s 25th Birthday Concert",
      startsAt: "2026-10-10T20:00:00-04:00",
      ticketSaleStartsAt: "2026-09-10T10:00:00-04:00",
      durationMinutes: 120
    }
  ];
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
      <section class="planner-agenda"><h3>Upcoming Events</h3>${events.length ? `<div class="upcoming-event-list">${events.filter((event) => new Date(event.startsAt) >= new Date()).map((event) => `<button type="button" class="upcoming-event-row" data-upcoming-event="${event.id}"><span>${new Date(event.startsAt).toLocaleDateString([], { month: "short", day: "numeric" })}</span><div><strong>${event.title}</strong><small>${event.subtitle || "Upcoming event"}</small></div><i>›</i></button>`).join("")}</div>` : `<p>No events scheduled yet.</p>`}</section>
    </div>`;
    host.querySelectorAll("[data-calendar-nav]").forEach((button) => button.addEventListener("click", () => { visibleMonth = new Date(year, month + Number(button.dataset.calendarNav), 1); render(); }));
    host.querySelectorAll("[data-calendar-date]").forEach((button) => button.addEventListener("click", () => openDate(new Date(button.dataset.calendarDate))));
    host.querySelectorAll("[data-upcoming-event]").forEach((button) => button.addEventListener("click", () => openEvent(button.dataset.upcomingEvent)));
  }

  function openEvent(eventId) {
    const event = events.find((item) => item.id === eventId);
    if (event) openDate(new Date(event.startsAt));
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
    const eventDate = new Date(event.startsAt);
    const dateLabel = event.type === "release"
      ? eventDate.toLocaleDateString([], { dateStyle: "full" })
      : eventDate.toLocaleString([], { dateStyle: "full", timeStyle: "short" });
    const eventActions = event.type === "release"
      ? `<div class="release-platforms">
          <button type="button" class="platform-button apple-button" disabled><span>Apple Music</span><small>Link coming soon</small></button>
          <button type="button" class="platform-button spotify-button" disabled><span>Spotify</span><small>Link coming soon</small></button>
          <div class="release-more"><span>YouTube</span><span>Amazon Music</span></div>
        </div>`
      : `<div class="concert-ticket-note"><span>Tickets on sale</span><strong>${new Date(event.ticketSaleStartsAt).toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" })}</strong></div>
        <button type="button" class="event-reserve" id="eventReserve">RSVP for ticket access</button>`;
    host.innerHTML = `<article class="event-detail"><button type="button" class="event-back" id="eventBack">‹ Calendar</button><span>${event.type === "release" ? "ALBUM RELEASE" : "BIRTHDAY CONCERT"}</span><h2>${event.title}</h2>${event.subtitle ? `<h3>${event.subtitle}</h3>` : ""}<p>${dateLabel}</p>${eventActions}</article>`;
    document.getElementById("eventBack").addEventListener("click", render);
    document.getElementById("eventReserve")?.addEventListener("click", () => openRsvp(event));
  }

  function openRsvp(event) {
    const modal = document.createElement("div");
    modal.className = "rsvp-modal";
    modal.innerHTML = `<div class="rsvp-card" role="dialog" aria-modal="true" aria-labelledby="rsvpTitle">
      <button class="rsvp-close" type="button" aria-label="Close RSVP">×</button>
      <span>RESERVE YOUR PLACE</span><h2 id="rsvpTitle">RSVP</h2>
      <p>Enter your details and we’ll email the ticket purchase link when tickets go on sale September 10.</p>
      <form class="rsvp-form"><input type="hidden" name="_subject" value="New myStage Concert RSVP"><input type="hidden" name="_template" value="table"><input class="project-honeypot" name="_honey" type="text" tabindex="-1" autocomplete="off"><input type="hidden" name="Event" value="Recently Deleted: Live at myStage Concert Venue"><input type="hidden" name="Event_Date" value="Saturday, October 10, 2026"><input type="hidden" name="Event_Time" value="8:00 PM ET"><input type="hidden" name="Tickets_On_Sale" value="September 10, 2026"><input type="hidden" name="Confirmation_Message" value="Tracey, Ed’s Assistant: RSVP confirmed for October 10, 2026 at 8:00 PM ET. Questions: d.wright@ghostsinshells.com"><label>Name<input name="name" type="text" autocomplete="name" required></label><label>Email address<input name="email" type="email" autocomplete="email" required></label><button type="submit">Join the RSVP list</button></form>
      <p class="rsvp-status" aria-live="polite"></p>
    </div>`;
    host.appendChild(modal);
    const close = () => modal.remove();
    modal.querySelector(".rsvp-close").addEventListener("click", close);
    modal.addEventListener("click", (clickEvent) => { if (clickEvent.target === modal) close(); });
    modal.querySelector("input").focus();
    modal.querySelector("form").addEventListener("submit", async (submitEvent) => {
      submitEvent.preventDefault();
      const form = submitEvent.currentTarget;
      const submitButton = form.querySelector("button[type='submit']");
      const status = modal.querySelector(".rsvp-status");
      const rsvp = { eventId: event.id, name: form.elements.name.value.trim(), email: form.elements.email.value.trim(), createdAt: new Date().toISOString() };
      submitButton.disabled = true;
      submitButton.textContent = "SENDING…";
      status.textContent = "";
      status.className = "rsvp-status";
      try {
        const payload = Object.fromEntries(new FormData(form).entries());
        const response = await fetch("https://formsubmit.co/ajax/d.wright@ghostsinshells.com", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error("Submission failed");
        const saved = JSON.parse(localStorage.getItem("myphone:rsvps") || "[]");
        saved.push(rsvp);
        localStorage.setItem("myphone:rsvps", JSON.stringify(saved));
        window.dispatchEvent(new CustomEvent("myphone:rsvp", { detail: rsvp }));
        form.hidden = true;
        status.textContent = "Your RSVP has been received. Tracey will follow up with event and ticket details.";
        status.classList.add("success");
      } catch {
        status.textContent = "We couldn’t send your RSVP. Please try again.";
        status.classList.add("error");
        submitButton.disabled = false;
        submitButton.textContent = "TRY AGAIN";
      }
    });
  }

  function open(element) { host = element; render(); }
  function addEvent(event) { events.push(event); events.sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt)); render(); }
  window.MyCalendar = { open, addEvent, openEvent, events };
}());
