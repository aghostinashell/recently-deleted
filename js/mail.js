"use strict";

(function createMailApp() {
  const trackEvent = (name, properties = {}, options = {}) =>
    window.GISAnalytics?.trackEvent(name, properties, options);
  const DATA_URL = "data/mail/ads.json";
  const DELIVERED_KEY = "myphone.mail.deliveries.v2";
  const UNREAD_KEY = "myphone.mail.unread.v2";
  const SENT_KEY = "myphone.mail.sent.v1";
  const ORDER_KEY = "myphone.supply.orders.v1";
  const DESKTOP_NOTIFICATION_KEY = "myphone.settings.desktop-notifications";
  const PREMIUM_PROTECTION_MS = 7 * 24 * 60 * 60 * 1000;
  const ORDER_STAGES = [
    ["confirmation", 0],
    ["shipping", 2 * 60 * 1000],
    ["delivered", 5 * 60 * 1000],
    ["followup", 8 * 60 * 1000]
  ];
  const FIRST_CAMPAIGN_ID = "blank-tab-studios";
  const STREAMING_CAMPAIGN_ID = "recently-deleted-streaming";
  const TIER_WEIGHTS = { Premium: 6, Standard: 3, Basic: 1 };
  let campaignsPromise = null;
  let timer = null;
  let timerStartedAt = 0;
  let remainingDelay = 45000;
  let pendingCampaignId = null;
  let editMode = false;
  let selectedDeliveryIds = new Set();

  function escapeHtml(value) {
    const node = document.createElement("div");
    node.textContent = String(value ?? "");
    return node.innerHTML;
  }

  function readList(key) {
    try { const value = JSON.parse(localStorage.getItem(key)); return Array.isArray(value) ? value : []; }
    catch { return []; }
  }

  function writeList(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function orderEmail(delivery) {
    const order = readList(ORDER_KEY).find((item) => item.id === delivery.orderId);
    if (!order) return null;
    const copy = {
      confirmation: ["We've got your order.", "Your order has been received and is now being prepared by our fulfillment team."],
      shipping: ["Your Ghost Supply order is on the way.", "Your order has been packaged and handed off to the carrier."],
      delivered: ["Your package has arrived.", "According to the carrier, your Ghost Supply order was successfully delivered today."],
      followup: ["How did we do?", "It's been a few days since your order was delivered, and I just wanted to check in."]
    }[delivery.stage];
    return copy ? { id: `order-${delivery.stage}`, sender: "Tracey", subject: copy[0], preview: copy[1], tier: "Basic", order, stage: delivery.stage } : null;
  }

  function mailForDelivery(delivery, campaigns) {
    return delivery.type === "order" ? orderEmail(delivery) : campaigns.find((item) => item.id === delivery.campaignId);
  }

  function showDesktopNotification(mail, delivery) {
    if (localStorage.getItem(DESKTOP_NOTIFICATION_KEY) !== "1" || !("Notification" in window) || Notification.permission !== "granted") return;
    new Notification(mail.subject, { body: mail.preview, tag: delivery.id });
  }

  async function getCampaigns() {
    if (!campaignsPromise) {
      campaignsPromise = fetch(DATA_URL).then((response) => {
        if (!response.ok) throw new Error("Sponsored Mail could not be loaded.");
        return response.json();
      }).then((data) => data.campaigns || []);
    }
    return campaignsPromise;
  }

  function syncUnreadBadge() {
    const count = readList(UNREAD_KEY).length;
    const allowed = localStorage.getItem("myphone.settings.notifications") !== "0";
    document.querySelectorAll("[data-mail-unread]").forEach((badge) => {
      badge.hidden = !allowed || count === 0;
      badge.textContent = count > 9 ? "9+" : String(count);
    });
  }

  function nextDelay() {
    return Math.round((5 + Math.random() * 4) * 60 * 1000);
  }

  function chooseCampaign(campaigns, deliveries) {
    if (!deliveries.length) {
      return campaigns.find((campaign) => campaign.id === FIRST_CAMPAIGN_ID) || campaigns[0];
    }

    const deliveredCampaignIds = new Set(deliveries.map((delivery) => delivery.campaignId));
    const firstUndeliveredByTier = ["Premium", "Standard", "Basic"]
      .flatMap((tier) => campaigns.filter((campaign) => campaign.tier === tier))
      .find((campaign) => !deliveredCampaignIds.has(campaign.id));
    if (firstUndeliveredByTier) return firstUndeliveredByTier;

    const previousCampaignId = deliveries.at(-1)?.campaignId;
    const weightedPool = campaigns.flatMap((campaign) =>
      Array(TIER_WEIGHTS[campaign.tier] || 1).fill(campaign)
    );
    const withoutImmediateRepeat = weightedPool.filter((campaign) => campaign.id !== previousCampaignId);
    const pool = withoutImmediateRepeat.length ? withoutImmediateRepeat : weightedPool;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function schedule(delay = remainingDelay) {
    window.clearTimeout(timer);
    remainingDelay = delay;
    timerStartedAt = Date.now();
    timer = window.setTimeout(deliverNextCampaign, delay);
  }

  function pauseTimer() {
    if (!timer) return;
    remainingDelay = Math.max(0, remainingDelay - (Date.now() - timerStartedAt));
    window.clearTimeout(timer);
    timer = null;
  }

  async function deliverNextCampaign() {
    timer = null;
    let campaigns = [];
    try { campaigns = await getCampaigns(); }
    catch {
      remainingDelay = 60000;
      schedule(remainingDelay);
      return;
    }
    if (!campaigns.length) return;
    const deliveries = readList(DELIVERED_KEY);
    const campaign = chooseCampaign(campaigns, deliveries);
    const delivery = {
      id: `${campaign.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      campaignId: campaign.id,
      deliveredAt: new Date().toISOString()
    };
    writeList(DELIVERED_KEY, [...deliveries, delivery]);
    writeList(UNREAD_KEY, [...readList(UNREAD_KEY), delivery.id]);
    syncUnreadBadge();
    showNotification(campaign, delivery);
    remainingDelay = nextDelay();
    schedule(remainingDelay);
  }

  async function deliverStreamingCampaign() {
    const deliveries = readList(DELIVERED_KEY);
    if (deliveries.some((delivery) => delivery.campaignId === STREAMING_CAMPAIGN_ID)) return;
    let campaigns = [];
    try { campaigns = await getCampaigns(); } catch { return; }
    const campaign = campaigns.find((item) => item.id === STREAMING_CAMPAIGN_ID);
    if (!campaign) return;
    const delivery = {
      id: `${campaign.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      campaignId: campaign.id,
      deliveredAt: new Date().toISOString()
    };
    writeList(DELIVERED_KEY, [...readList(DELIVERED_KEY), delivery]);
    writeList(UNREAD_KEY, [...readList(UNREAD_KEY), delivery.id]);
    syncUnreadBadge();
    showNotification(campaign, delivery);
    const openMailHost = document.getElementById("appContent");
    if (openMailHost?.classList.contains("mail-app-content") && openMailHost.querySelector(".mail-inbox")) renderInbox(openMailHost, campaigns);
  }

  function showNotification(campaign, delivery) {
    if (localStorage.getItem("myphone.settings.notifications") === "0") return;
    let banner = document.getElementById("mailNotificationBanner");
    if (!banner) {
      banner = document.createElement("button");
      banner.id = "mailNotificationBanner";
      banner.className = "mail-notification-banner";
      banner.type = "button";
      document.getElementById("device")?.appendChild(banner);
      let startY = 0;
      let offsetY = 0;
      let moved = false;
      banner.addEventListener("pointerdown", (event) => {
        startY = event.clientY; offsetY = 0; moved = false;
        banner.setPointerCapture(event.pointerId);
        banner.classList.add("dragging");
      });
      banner.addEventListener("pointermove", (event) => {
        if (!banner.hasPointerCapture(event.pointerId)) return;
        offsetY = Math.min(0, event.clientY - startY);
        moved = moved || Math.abs(offsetY) > 6;
        banner.style.transform = `translateY(${offsetY}px)`;
        banner.style.opacity = String(Math.max(.15, 1 - Math.abs(offsetY) / 120));
      });
      banner.addEventListener("pointerup", (event) => {
        banner.releasePointerCapture(event.pointerId);
        banner.classList.remove("dragging");
        banner.style.transform = ""; banner.style.opacity = "";
        if (offsetY < -42) {
          banner.classList.add("leaving"); banner.classList.remove("visible");
        } else if (!moved) openFromNotification(banner.dataset.deliveryId);
      });
    }
    banner.innerHTML = `<span class="mail-notification-icon">✉</span><span><small>MAIL · NOW</small><strong>${escapeHtml(campaign.subject)}</strong><p>${escapeHtml(campaign.preview)}</p></span>`;
    banner.dataset.deliveryId = delivery.id;
    banner.onclick = null;
    banner.classList.remove("visible", "leaving");
    void banner.offsetWidth;
    banner.classList.add("visible");
    window.setTimeout(() => {
      banner.classList.add("leaving");
      banner.classList.remove("visible");
    }, 6500);
    showDesktopNotification(campaign, delivery);
  }

  function openFromNotification(deliveryId) {
    pendingCampaignId = deliveryId;
    document.querySelector('[data-app-id="mail"]')?.click();
    document.getElementById("mailNotificationBanner")?.classList.remove("visible");
  }

  function renderEmailBody(campaign) {
    return `
      ${campaign.body.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}
      ${campaign.sections.map((section) => `<section class="sponsored-section"><h3>${escapeHtml(section.title)}</h3>${section.price ? `<strong>${escapeHtml(section.price)}</strong>` : ""}${section.description ? `<p>${escapeHtml(section.description)}</p>` : ""}${section.items?.length ? `<ul>${section.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : ""}</section>`).join("")}
      <div class="sponsored-closing">${campaign.closing.map((line) => `<p>${escapeHtml(line)}</p>`).join("")}</div>
      ${campaign.id === STREAMING_CAMPAIGN_ID ? `<div class="streaming-actions"><button class="sponsored-cta" type="button" data-open-music-app>${escapeHtml(campaign.cta)}</button>${[["Apple Music",campaign.streaming?.appleMusic],["Spotify",campaign.streaming?.spotify],["YouTube",campaign.streaming?.youtube],["Amazon Music",campaign.streaming?.amazonMusic]].map(([name,url])=>url?`<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(name)}</a>`:`<span>${escapeHtml(name)}<small>LINK COMING SOON</small></span>`).join("")}</div>` : campaign.id === "blank-tab-studios" ? `<button class="sponsored-cta" type="button" data-open-project-form>${escapeHtml(campaign.cta)}</button>` : campaign.id === "inkworks-media-group" ? `<button class="sponsored-cta" type="button" data-open-artist-form>${escapeHtml(campaign.cta)}</button>` : campaign.id === "ghosts-in-shells" ? `<button class="sponsored-cta" type="button" data-open-ghosts-form>START A PROJECT</button>` : campaign.id === "fi-entertainment" ? `<button class="sponsored-cta" type="button" data-open-fi-form>${escapeHtml(campaign.cta)}</button>` : campaign.url ? `<a class="sponsored-cta" href="${escapeHtml(campaign.url)}" target="_blank" rel="noopener noreferrer sponsored">${escapeHtml(campaign.cta)}</a>` : `<span class="sponsored-cta disabled" aria-disabled="true">${escapeHtml(campaign.cta)} · LINK COMING SOON</span>`}
    `;
  }

  function openProjectForm(host, campaign, delivery, campaigns) {
    host.innerHTML = `
      <article class="project-inquiry">
        <button class="mail-back" type="button" data-project-back>‹ Back</button>
        <header><span>Blank Tab Studios</span><h2>Start Your Project</h2><p>Tell us what you’re building and we’ll follow up with next steps.</p></header>
        <form data-project-form>
          <label>NAME<input name="name" type="text" autocomplete="name" required></label>
          <label>EMAIL<input name="email" type="email" autocomplete="email" required></label>
          <label>BUSINESS OR PROJECT NAME<input name="business_or_project_name" type="text" required></label>
          <label>WEBSITE PACKAGE<select name="website_package" required><option value="" selected disabled>Select a package</option><option>Starter Page — $600 launch offer</option><option>Business Site — $1,200 launch offer</option><option>Interactive Experience — starting at $2,400</option></select></label>
          <label>BUDGET RANGE<select name="budget_range" required><option value="" selected disabled>Select a range</option><option>Under $1,000</option><option>$1,000–$2,499</option><option>$2,500–$4,999</option><option>$5,000–$9,999</option><option>$10,000+</option></select></label>
          <label>PROJECT DESCRIPTION<textarea name="project_description" rows="5" required></textarea></label>
          <label>DESIRED LAUNCH DATE<input name="desired_launch_date" type="date" required></label>
          <input class="project-honeypot" name="_honey" type="text" tabindex="-1" autocomplete="off">
          <input name="_subject" type="hidden" value="New Blank Tab Studios project inquiry">
          <input name="_template" type="hidden" value="table">
          <p class="project-privacy">By submitting, you agree that Blank Tab Studios may use this information to review your request and contact you about your project.</p>
          <button class="project-submit" type="submit">SEND PROJECT REQUEST</button>
          <p class="project-form-status" data-project-status aria-live="polite"></p>
        </form>
      </article>`;

    host.querySelector("[data-project-back]").addEventListener("click", () => openEmail(host, campaign, delivery, campaigns));
    host.querySelector("[data-project-form]").addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const button = form.querySelector(".project-submit");
      const status = form.querySelector("[data-project-status]");
      button.disabled = true;
      button.textContent = "SENDING…";
      status.textContent = "";

      try {
        const payload = Object.fromEntries(new FormData(form).entries());
        const response = await fetch("https://formsubmit.co/ajax/d.wright@ghostsinshells.com", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Accept": "application/json" },
          body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error("Submission failed");
        form.reset();
        form.classList.add("submitted");
        status.textContent = "Your project request has been submitted. We’ll be in touch.";
        button.textContent = "REQUEST SENT";
      } catch {
        status.textContent = "We couldn’t send your request. Please try again.";
        button.disabled = false;
        button.textContent = "SEND PROJECT REQUEST";
      }
    });
    document.getElementById("appWindow").scrollTop = 0;
  }

  function openArtistForm(host, campaign, delivery, campaigns) {
    host.innerHTML = `
      <article class="project-inquiry artist-inquiry">
        <button class="mail-back" type="button" data-artist-back>‹ Back</button>
        <header><span>Inkworks Media Group</span><h2>Submit Your Music</h2><p>Share your artist information and current platforms for consideration.</p></header>
        <form data-artist-form>
          <label>NAME<input name="name" type="text" autocomplete="name" required></label>
          <label>EPK<select name="epk" required><option value="" selected disabled>Select one</option><option>Yes</option><option>No</option></select></label>
          <label>PRO<select name="pro" required><option value="" selected disabled>Select your PRO</option><option>BMI</option><option>SESAC</option><option>ASCAP</option><option>None</option></select></label>
          <label>WEBSITE<input name="website" type="url" inputmode="url" placeholder="https://"></label>
          <label>INSTAGRAM LINK<input name="instagram" type="url" inputmode="url" placeholder="https://instagram.com/"></label>
          <label>YOUTUBE LINK<input name="youtube" type="url" inputmode="url" placeholder="https://youtube.com/"></label>
          <label>SOUNDCLOUD LINK<input name="soundcloud" type="url" inputmode="url" placeholder="https://soundcloud.com/"></label>
          <input class="project-honeypot" name="_honey" type="text" tabindex="-1" autocomplete="off">
          <input name="_subject" type="hidden" value="New Inkworks Media Group artist submission">
          <input name="_template" type="hidden" value="table">
          <p class="project-privacy">By submitting, you agree that Inkworks Media Group may use this information to review your music and contact you about potential opportunities.</p>
          <button class="project-submit" type="submit">SEND ARTIST SUBMISSION</button>
          <p class="project-form-status" data-artist-status aria-live="polite"></p>
        </form>
      </article>`;

    host.querySelector("[data-artist-back]").addEventListener("click", () => openEmail(host, campaign, delivery, campaigns));
    host.querySelector("[data-artist-form]").addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const button = form.querySelector(".project-submit");
      const status = form.querySelector("[data-artist-status]");
      button.disabled = true;
      button.textContent = "SENDING…";
      status.textContent = "";

      try {
        const payload = Object.fromEntries(new FormData(form).entries());
        const response = await fetch("https://formsubmit.co/ajax/d.wright@ghostsinshells.com", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Accept": "application/json" },
          body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error("Submission failed");
        form.reset();
        form.classList.add("submitted");
        status.textContent = "Your artist submission has been received. We’ll be in touch if it’s a fit.";
        button.textContent = "SUBMISSION SENT";
      } catch {
        status.textContent = "We couldn’t send your submission. Please try again.";
        button.disabled = false;
        button.textContent = "SEND ARTIST SUBMISSION";
      }
    });
    document.getElementById("appWindow").scrollTop = 0;
  }

  function openGhostsForm(host, campaign, delivery, campaigns) {
    host.innerHTML = `
      <article class="project-inquiry ghosts-inquiry">
        <button class="mail-back" type="button" data-ghosts-back>‹ Back</button>
        <header><img class="inquiry-brand-logo" src="${escapeHtml(campaign.logo)}" alt="Ghosts In Shells logo"><span>Ghosts In Shells</span><h2>Tell Us About Your Project</h2><p>Describe what you’re building and where you need support.</p></header>
        <form data-ghosts-form>
          <label>NAME<input name="name" type="text" autocomplete="name" required></label>
          <label>EMAIL<input name="email" type="email" autocomplete="email" required></label>
          <label>PROJECT DESCRIPTION<textarea name="project_description" rows="8" maxlength="5000" required data-project-description></textarea><small class="character-count" data-character-count>0 / 5,000</small></label>
          <label>ESTIMATED BUDGET <em>OPTIONAL</em><input name="budget" type="text" inputmode="decimal" placeholder="Example: $2,500"></label>
          <input class="project-honeypot" name="_honey" type="text" tabindex="-1" autocomplete="off">
          <input name="_subject" type="hidden" value="New Ghosts In Shells project request">
          <input name="_template" type="hidden" value="table">
          <p class="project-privacy">By submitting, you agree that Ghosts In Shells may use this information to review your request and contact you about your project.</p>
          <button class="project-submit" type="submit">SEND PROJECT REQUEST</button>
          <p class="project-form-status" data-ghosts-status aria-live="polite"></p>
        </form>
      </article>`;

    const description = host.querySelector("[data-project-description]");
    const characterCount = host.querySelector("[data-character-count]");
    description.addEventListener("input", () => { characterCount.textContent = `${description.value.length.toLocaleString()} / 5,000`; });
    host.querySelector("[data-ghosts-back]").addEventListener("click", () => openEmail(host, campaign, delivery, campaigns));
    host.querySelector("[data-ghosts-form]").addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const button = form.querySelector(".project-submit");
      const status = form.querySelector("[data-ghosts-status]");
      button.disabled = true;
      button.textContent = "SENDING…";
      status.textContent = "";

      try {
        const payload = Object.fromEntries(new FormData(form).entries());
        const response = await fetch("https://formsubmit.co/ajax/d.wright@ghostsinshells.com", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Accept": "application/json" },
          body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error("Submission failed");
        form.reset();
        form.classList.add("submitted");
        status.textContent = "Your project request has been received. We’ll be in touch.";
        button.textContent = "REQUEST SENT";
      } catch {
        status.textContent = "We couldn’t send your request. Please try again.";
        button.disabled = false;
        button.textContent = "SEND PROJECT REQUEST";
      }
    });
    document.getElementById("appWindow").scrollTop = 0;
  }

  function openFiForm(host, campaign, delivery, campaigns) {
    host.innerHTML = `
      <article class="project-inquiry fi-inquiry">
        <button class="mail-back" type="button" data-fi-back>‹ Back</button>
        <header><span>Fi Entertainment</span><h2>Apply for Management</h2><p>Share your artist information and current platforms for consideration.</p></header>
        <form data-fi-form>
          <label>NAME<input name="name" type="text" autocomplete="name" required></label>
          <label>ARTIST NAME<input name="artist_name" type="text" required></label>
          <label>PHONE NUMBER<input name="phone_number" type="tel" autocomplete="tel" inputmode="tel" required></label>
          <label>EMAIL<input name="email" type="email" autocomplete="email" required></label>
          <label>EPK<select name="epk" required><option value="" selected disabled>Select one</option><option>Yes</option><option>No</option></select></label>
          <label>PRO<select name="pro" required><option value="" selected disabled>Select your PRO</option><option>BMI</option><option>SESAC</option><option>ASCAP</option><option>None</option></select></label>
          <label>INSTAGRAM LINK<input name="instagram" type="url" inputmode="url" placeholder="https://instagram.com/"></label>
          <label>YOUTUBE LINK<input name="youtube" type="url" inputmode="url" placeholder="https://youtube.com/"></label>
          <label>SOUNDCLOUD LINK<input name="soundcloud" type="url" inputmode="url" placeholder="https://soundcloud.com/"></label>
          <label>SPOTIFY LINK<input name="spotify" type="url" inputmode="url" placeholder="https://open.spotify.com/"></label>
          <input class="project-honeypot" name="_honey" type="text" tabindex="-1" autocomplete="off">
          <input name="_subject" type="hidden" value="New Fi Entertainment management application">
          <input name="_cc" type="hidden" value="d.wright@ghostsinshells.com">
          <input name="_template" type="hidden" value="table">
          <p class="project-privacy">By submitting, you agree that Fi Entertainment may use this information to review your application and contact you about potential management opportunities.</p>
          <button class="project-submit" type="submit">SEND APPLICATION</button>
          <p class="project-form-status" data-fi-status aria-live="polite"></p>
        </form>
      </article>`;

    host.querySelector("[data-fi-back]").addEventListener("click", () => openEmail(host, campaign, delivery, campaigns));
    host.querySelector("[data-fi-form]").addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const button = form.querySelector(".project-submit");
      const status = form.querySelector("[data-fi-status]");
      button.disabled = true;
      button.textContent = "SENDING…";
      status.textContent = "";
      try {
        const payload = Object.fromEntries(new FormData(form).entries());
        const response = await fetch("https://formsubmit.co/ajax/fi.ent@outlook.com", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Accept": "application/json" },
          body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error("Submission failed");
        form.reset();
        form.classList.add("submitted");
        status.textContent = "Your management application has been received. We’ll be in touch if it’s a fit.";
        button.textContent = "APPLICATION SENT";
      } catch {
        status.textContent = "We couldn’t send your application. Please try again.";
        button.disabled = false;
        button.textContent = "SEND APPLICATION";
      }
    });
    document.getElementById("appWindow").scrollTop = 0;
  }

  function deliveryTime(delivery) {
    const date = new Date(delivery.deliveredAt);
    return Number.isNaN(date.getTime()) ? "Now" : date.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  }

  function openEmail(host, campaign, delivery, campaigns) {
    trackEvent("mail_message_opened", {
      app_name: "mail",
      content_id: campaign.id,
      content_title: campaign.subject,
      message_category: campaign.tier || "standard"
    });
    writeList(UNREAD_KEY, readList(UNREAD_KEY).filter((id) => id !== delivery.id));
    syncUnreadBadge();
    host.innerHTML = `
      <article class="sponsored-email">
        <button class="mail-back" type="button" data-mail-back>‹ Inbox</button>
        <header class="sponsored-email-header">${campaign.logo ? `<img class="sponsored-email-logo" src="${escapeHtml(campaign.logo)}" alt="${escapeHtml(campaign.sender)} logo">` : ""}<h2>${escapeHtml(campaign.sender)}</h2><h1>${escapeHtml(campaign.headline)}</h1><p>To: Ed</p><time>${escapeHtml(deliveryTime(delivery))}</time></header>
        <div class="sponsored-email-body">${renderEmailBody(campaign)}</div>
      </article>`;
    host.querySelector("[data-mail-back]").addEventListener("click", () => {
      trackEvent("mail_message_closed", { app_name: "mail", content_id: campaign.id });
      renderInbox(host, campaigns);
    });
    const bindContact = (selector, callback) => host.querySelector(selector)?.addEventListener("click", () => {
      trackEvent("reply_or_contact_clicked", { app_name: "mail", content_id: campaign.id, interaction_type: selector.slice(1, -1) });
      callback();
    });
    bindContact("[data-open-project-form]", () => openProjectForm(host, campaign, delivery, campaigns));
    bindContact("[data-open-artist-form]", () => openArtistForm(host, campaign, delivery, campaigns));
    bindContact("[data-open-ghosts-form]", () => openGhostsForm(host, campaign, delivery, campaigns));
    bindContact("[data-open-fi-form]", () => openFiForm(host, campaign, delivery, campaigns));
    bindContact("[data-open-music-app]", () => document.querySelector('[data-app-id="music"]')?.click());
    host.querySelectorAll("a[href]").forEach((link) => link.addEventListener("click", () => {
      trackEvent("mail_link_clicked", {
        app_name: "mail",
        content_id: campaign.id,
        link_host: new URL(link.href, location.href).hostname
      });
    }));
    document.getElementById("appWindow").scrollTop = 0;
  }

  function openComposer(host, campaigns) {
    host.innerHTML = `
      <section class="mail-compose">
        <header><button type="button" data-compose-cancel>Cancel</button><h2>New Message</h2><button type="submit" form="edMailComposer">Send</button></header>
        <form id="edMailComposer" data-mail-compose>
          <label><span>To:</span><input value="Ed X" aria-label="To" disabled></label>
          <label><span>From:</span><input name="from" type="text" placeholder="Name or Email" aria-label="Name or Email" required></label>
          <label><span>Subject:</span><input name="subject" type="text" aria-label="Subject" required></label>
          <textarea name="message" placeholder="Leave a comment or review" aria-label="Message" required></textarea>
          <p data-compose-status aria-live="polite"></p>
        </form>
      </section>`;
    host.querySelector("[data-compose-cancel]").addEventListener("click", () => renderInbox(host, campaigns));
    host.querySelector("[data-mail-compose]").addEventListener("submit", (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const values = Object.fromEntries(new FormData(form).entries());
      const sent = readList(SENT_KEY);
      writeList(SENT_KEY, [...sent, { ...values, to: "Ed X", sentAt: new Date().toISOString() }]);
      form.reset();
      form.querySelector("[data-compose-status]").textContent = "Message sent to Ed X.";
      window.setTimeout(() => renderInbox(host, campaigns), 900);
    });
    document.getElementById("appWindow").scrollTop = 0;
  }

  function openOrderEmail(host, mail, delivery, campaigns) {
    const order = mail.order;
    const first = escapeHtml(order.firstName || "there");
    const facts = (rows) => `<div class="order-email-facts">${rows.map(([label,value]) => `<p><b>${label}</b><span>${escapeHtml(value)}</span></p>`).join("")}</div>`;
    let body = "";
    if (mail.stage === "confirmation") body = `<p>Hey, ${first},</p><p>Thanks for shopping with Ghost Supply.</p><p>Your order has been received and is now being prepared by our fulfillment team. We'll send another email as soon as your package is on the way with tracking information so you can follow every step of the delivery.</p>${facts([["Order Number",order.id],["Order Date",new Date(order.createdAt).toLocaleDateString()],["Payment Method",order.paymentMethod],["Shipping To",`${order.firstName}\n${order.shippingAddress}`]])}<p>If you need to make changes before your order ships, simply reply to this email and we'll do our best to help.</p><p>Thank you for supporting Ghost Supply.</p>`;
    if (mail.stage === "shipping") body = `<p>Hey, ${first},</p><p>Good news.</p><p>Your order has been packaged and handed off to the carrier.</p>${facts([["Tracking Number",order.trackingNumber],["Carrier",order.carrier],["Estimated Delivery",order.estimatedDelivery]])}<p>Track your shipment anytime:</p><p>${escapeHtml(order.trackingLink)}</p><p>We'll continue working behind the scenes to make sure everything arrives safely.</p><p>Thanks again for choosing Ghost Supply.</p>`;
    if (mail.stage === "delivered") body = `<p>Hey, ${first},</p><p>According to the carrier, your Ghost Supply order was successfully delivered today.</p><p>We hope everything arrived safely and exactly as expected.</p><p>If you have any questions about your order or notice an issue with your delivery, just reply to this email and we'll be happy to help.</p><p>Thank you for supporting Ghost Supply.</p><p>Enjoy your gear.</p>`;
    if (mail.stage === "followup") body = `<p>Hey, ${first},</p><p>It's been a few days since your order was delivered, and I just wanted to check in.</p><p>Hopefully you're enjoying everything you received.</p><p>If there's anything we can improve, or if you have questions about your order, simply reply to this email. We read every message and appreciate your feedback.</p><p>If you loved your experience, we'd also appreciate you sharing your thoughts with the community.</p><p>Thank you for supporting Ghost Supply. We truly appreciate every order.</p><p>See you again soon.</p>`;
    host.innerHTML = `<article class="sponsored-email order-email"><button class="mail-back" type="button" data-mail-back>‹ Inbox</button><header><span class="sponsored-sender-mark">GS</span><div><strong>Tracey</strong><small>Operations Manager · Ghost Supply</small></div></header><h1>${escapeHtml(mail.subject)}</h1><div class="sponsored-copy">${body}<div class="sponsored-closing"><p>— Tracey</p><p>Operations Manager</p><p>Ghost Supply</p></div></div></article>`;
    writeList(UNREAD_KEY, readList(UNREAD_KEY).filter((id) => id !== delivery.id));
    syncUnreadBadge();
    host.querySelector("[data-mail-back]").addEventListener("click", () => renderInbox(host, campaigns));
    document.getElementById("appWindow").scrollTop = 0;
  }

  function processOrderMail() {
    const orders = readList(ORDER_KEY);
    if (!orders.length) return;
    let deliveries = readList(DELIVERED_KEY);
    orders.forEach((order) => ORDER_STAGES.forEach(([stage, delay]) => {
      if (Date.now() < new Date(order.createdAt).getTime() + delay || deliveries.some((item) => item.type === "order" && item.orderId === order.id && item.stage === stage)) return;
      const delivery = { id: `order-${order.id}-${stage}`, type: "order", orderId: order.id, stage, deliveredAt: new Date().toISOString() };
      deliveries.push(delivery);
      writeList(UNREAD_KEY, [...readList(UNREAD_KEY), delivery.id]);
      const mail = orderEmail(delivery);
      if (mail) showNotification(mail, delivery);
    }));
    writeList(DELIVERED_KEY, deliveries);
    syncUnreadBadge();
  }

  function createSupplyOrder(order) {
    const deliveryDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric" });
    const saved = { ...order, carrier: "Ghost Supply Ground", trackingNumber: `GSX${Date.now().toString().slice(-9)}`, estimatedDelivery: deliveryDate, trackingLink: "Tracking available inside myPhone Mail" };
    writeList(ORDER_KEY, [...readList(ORDER_KEY), saved]);
    processOrderMail();
    const host = document.getElementById("appContent");
    if (host?.querySelector(".mail-inbox")) getCampaigns().then((campaigns) => renderInbox(host, campaigns));
  }

  function renderInbox(host, campaigns) {
    trackEvent("mailbox_viewed", { app_name: "mail", mailbox: "inbox" });
    const deliveries = readList(DELIVERED_KEY);
    const unread = readList(UNREAD_KEY);
    const inbox = deliveries.map((delivery) => ({ delivery, campaign: mailForDelivery(delivery, campaigns) })).filter((item) => item.campaign).reverse();
    host.innerHTML = `
      <section class="mail-inbox ${editMode ? "editing" : ""}">
        <header><button type="button" data-mail-edit>${editMode ? "Done" : "Edit"}</button><h2>Inbox</h2><button type="button" data-mail-compose-new aria-label="Compose new message">□</button></header>
        <div class="mail-inbox-list">${inbox.length ? inbox.map(({ campaign, delivery }) => {
          const premium = campaign.tier === "Premium";
          const protectedPremium = premium && Date.now() - new Date(delivery.deliveredAt).getTime() < PREMIUM_PROTECTION_MS;
          const selected = selectedDeliveryIds.has(delivery.id);
          return `<div class="mail-row-wrap ${premium ? "premium" : ""} ${selected ? "selected" : ""}">${editMode ? `<button class="mail-select" type="button" ${protectedPremium ? "disabled" : `data-select-delivery="${escapeHtml(delivery.id)}"`} aria-label="${protectedPremium ? "Premium mail is protected for seven days" : `Select email from ${escapeHtml(campaign.sender)}`}">${protectedPremium ? "★" : selected ? "✓" : ""}</button>` : ""}<button class="mail-row ${unread.includes(delivery.id) ? "unread" : ""}" type="button" ${editMode && !protectedPremium ? `data-select-delivery="${escapeHtml(delivery.id)}"` : `data-delivery-id="${escapeHtml(delivery.id)}"`}><i></i><span><strong>${premium ? `<b class="mail-favorite-star" aria-label="Favorite">★</b>` : ""}${escapeHtml(campaign.sender)}</strong><time>${escapeHtml(deliveryTime(delivery))}</time><b>${escapeHtml(campaign.subject)}</b><p>${escapeHtml(campaign.preview)}</p></span><em>${editMode ? protectedPremium ? "★" : "" : "›"}</em></button></div>`;
        }).join("") : `<p class="empty-state">No mail yet.<br>New messages arrive while you explore.</p>`}</div>
        ${editMode ? `<div class="mail-edit-toolbar"><button type="button" data-delete-mail ${selectedDeliveryIds.size ? "" : "disabled"}>Delete${selectedDeliveryIds.size ? ` (${selectedDeliveryIds.size})` : ""}</button><small>Premium mail is protected for seven days.</small></div>` : ""}
      </section>`;
    host.querySelector("[data-mail-edit]").addEventListener("click", () => {
      editMode = !editMode;
      selectedDeliveryIds = new Set();
      renderInbox(host, campaigns);
    });
    host.querySelector("[data-mail-compose-new]").addEventListener("click", () => openComposer(host, campaigns));
    host.querySelectorAll("[data-select-delivery]").forEach((button) => button.addEventListener("click", () => {
      const id = button.dataset.selectDelivery;
      if (selectedDeliveryIds.has(id)) selectedDeliveryIds.delete(id); else selectedDeliveryIds.add(id);
      renderInbox(host, campaigns);
    }));
    host.querySelector("[data-delete-mail]")?.addEventListener("click", () => {
      writeList(DELIVERED_KEY, deliveries.filter((delivery) => !selectedDeliveryIds.has(delivery.id)));
      writeList(UNREAD_KEY, unread.filter((id) => !selectedDeliveryIds.has(id)));
      selectedDeliveryIds = new Set();
      editMode = false;
      syncUnreadBadge();
      renderInbox(host, campaigns);
    });
    host.querySelectorAll("[data-delivery-id]").forEach((button) => button.addEventListener("click", () => {
      const delivery = deliveries.find((item) => item.id === button.dataset.deliveryId);
      const campaign = delivery && mailForDelivery(delivery, campaigns);
      if (campaign?.order && delivery) openOrderEmail(host, campaign, delivery, campaigns);
      else if (campaign && delivery) openEmail(host, campaign, delivery, campaigns);
    }));
  }

  async function openInbox(host) {
    trackEvent("section_viewed", { app_name: "mail", section: "inbox" });
    host.innerHTML = `<p class="app-loading">Loading Mail…</p>`;
    try {
      const campaigns = await getCampaigns();
      const requestedDeliveryId = pendingCampaignId;
      pendingCampaignId = null;
      if (requestedDeliveryId) {
        const delivery = readList(DELIVERED_KEY).find((item) => item.id === requestedDeliveryId);
        const campaign = delivery && mailForDelivery(delivery, campaigns);
        if (campaign?.order && delivery) return openOrderEmail(host, campaign, delivery, campaigns);
        if (campaign && delivery) return openEmail(host, campaign, delivery, campaigns);
      }
      renderInbox(host, campaigns);
    } catch (error) {
      host.innerHTML = `<p class="app-error">${escapeHtml(error.message)}</p>`;
    }
  }

  async function openCampaign(host, campaignId) {
    const campaigns = await getCampaigns();
    const campaign = campaigns.find((item) => item.id === campaignId);
    if (!campaign) return renderInbox(host, campaigns);
    openEmail(host, campaign, { id: `phone-${campaignId}`, campaignId, deliveredAt: new Date().toISOString() }, campaigns);
  }

  function initialize() {
    syncUnreadBadge();
    processOrderMail();
    window.setInterval(processOrderMail, 30000);
    window.setTimeout(deliverStreamingCampaign, 5000);
    schedule(45000);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) pauseTimer();
      else if (!timer) schedule(remainingDelay);
    });
  }

  window.MyMail = { initialize, openInbox, openCampaign, syncUnreadBadge, createSupplyOrder };
})();
