"use strict";

(function createMailApp() {
  const DATA_URL = "data/mail/ads.json";
  const DELIVERED_KEY = "myphone.mail.deliveries.v2";
  const UNREAD_KEY = "myphone.mail.unread.v2";
  const FIRST_CAMPAIGN_ID = "blank-tab-studios";
  const TIER_WEIGHTS = { Premium: 6, Standard: 3, Basic: 1 };
  let campaignsPromise = null;
  let timer = null;
  let timerStartedAt = 0;
  let remainingDelay = 45000;
  let pendingCampaignId = null;

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

  function showNotification(campaign, delivery) {
    if (localStorage.getItem("myphone.settings.notifications") === "0") return;
    let banner = document.getElementById("mailNotificationBanner");
    if (!banner) {
      banner = document.createElement("button");
      banner.id = "mailNotificationBanner";
      banner.className = "mail-notification-banner";
      banner.type = "button";
      document.getElementById("device")?.appendChild(banner);
    }
    banner.innerHTML = `<span class="mail-notification-icon">✉</span><span><small>MAIL · NOW</small><strong>${escapeHtml(campaign.subject)}</strong><p>${escapeHtml(campaign.preview)}</p></span>`;
    banner.onclick = () => openFromNotification(delivery.id);
    banner.classList.remove("visible", "leaving");
    void banner.offsetWidth;
    banner.classList.add("visible");
    window.setTimeout(() => {
      banner.classList.add("leaving");
      banner.classList.remove("visible");
    }, 6500);
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
      ${campaign.id === "blank-tab-studios" ? `<button class="sponsored-cta" type="button" data-open-project-form>${escapeHtml(campaign.cta)}</button>` : campaign.id === "inkworks-media-group" ? `<button class="sponsored-cta" type="button" data-open-artist-form>${escapeHtml(campaign.cta)}</button>` : campaign.id === "ghosts-in-shells" ? `<button class="sponsored-cta" type="button" data-open-ghosts-form>START A PROJECT</button>` : campaign.url ? `<a class="sponsored-cta" href="${escapeHtml(campaign.url)}" target="_blank" rel="noopener noreferrer sponsored">${escapeHtml(campaign.cta)}</a>` : `<span class="sponsored-cta disabled" aria-disabled="true">${escapeHtml(campaign.cta)} · LINK COMING SOON</span>`}
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

  function deliveryTime(delivery) {
    const date = new Date(delivery.deliveredAt);
    return Number.isNaN(date.getTime()) ? "Now" : date.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  }

  function openEmail(host, campaign, delivery, campaigns) {
    writeList(UNREAD_KEY, readList(UNREAD_KEY).filter((id) => id !== delivery.id));
    syncUnreadBadge();
    host.innerHTML = `
      <article class="sponsored-email">
        <button class="mail-back" type="button" data-mail-back>‹ Inbox</button>
        <header class="sponsored-email-header"><span>${escapeHtml(campaign.label)}</span>${campaign.logo ? `<img class="sponsored-email-logo" src="${escapeHtml(campaign.logo)}" alt="${escapeHtml(campaign.sender)} logo">` : ""}<h2>${escapeHtml(campaign.sender)}</h2><h1>${escapeHtml(campaign.headline)}</h1><p>To: Ed</p><time>${escapeHtml(deliveryTime(delivery))}</time></header>
        <div class="sponsored-email-body">${renderEmailBody(campaign)}</div>
      </article>`;
    host.querySelector("[data-mail-back]").addEventListener("click", () => renderInbox(host, campaigns));
    host.querySelector("[data-open-project-form]")?.addEventListener("click", () => openProjectForm(host, campaign, delivery, campaigns));
    host.querySelector("[data-open-artist-form]")?.addEventListener("click", () => openArtistForm(host, campaign, delivery, campaigns));
    host.querySelector("[data-open-ghosts-form]")?.addEventListener("click", () => openGhostsForm(host, campaign, delivery, campaigns));
    document.getElementById("appWindow").scrollTop = 0;
  }

  function renderInbox(host, campaigns) {
    const deliveries = readList(DELIVERED_KEY);
    const unread = readList(UNREAD_KEY);
    const inbox = deliveries.map((delivery) => ({ delivery, campaign: campaigns.find((campaign) => campaign.id === delivery.campaignId) })).filter((item) => item.campaign).reverse();
    host.innerHTML = `
      <section class="mail-inbox">
        <header><button type="button">Edit</button><h2>Inbox</h2><button type="button" aria-label="Compose">□</button></header>
        <div class="mail-inbox-list">${inbox.length ? inbox.map(({ campaign, delivery }) => `<button class="mail-row ${unread.includes(delivery.id) ? "unread" : ""}" type="button" data-delivery-id="${escapeHtml(delivery.id)}"><i></i><span><strong>${escapeHtml(campaign.sender)}</strong><time>${escapeHtml(deliveryTime(delivery))}</time><b>${escapeHtml(campaign.subject)}</b><p>${escapeHtml(campaign.preview)}</p><small>${escapeHtml(campaign.label)} · ${escapeHtml(campaign.tier)}</small></span><em>›</em></button>`).join("") : `<p class="empty-state">No mail yet.<br>New messages arrive while you explore.</p>`}</div>
      </section>`;
    host.querySelectorAll("[data-delivery-id]").forEach((button) => button.addEventListener("click", () => {
      const delivery = deliveries.find((item) => item.id === button.dataset.deliveryId);
      const campaign = campaigns.find((item) => item.id === delivery?.campaignId);
      if (campaign && delivery) openEmail(host, campaign, delivery, campaigns);
    }));
  }

  async function openInbox(host) {
    host.innerHTML = `<p class="app-loading">Loading Mail…</p>`;
    try {
      const campaigns = await getCampaigns();
      const requestedDeliveryId = pendingCampaignId;
      pendingCampaignId = null;
      if (requestedDeliveryId) {
        const delivery = readList(DELIVERED_KEY).find((item) => item.id === requestedDeliveryId);
        const campaign = campaigns.find((item) => item.id === delivery?.campaignId);
        if (campaign && delivery) return openEmail(host, campaign, delivery, campaigns);
      }
      renderInbox(host, campaigns);
    } catch (error) {
      host.innerHTML = `<p class="app-error">${escapeHtml(error.message)}</p>`;
    }
  }

  function initialize() {
    syncUnreadBadge();
    schedule(45000);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) pauseTimer();
      else if (!timer) schedule(remainingDelay);
    });
  }

  window.MyMail = { initialize, openInbox, syncUnreadBadge };
})();
