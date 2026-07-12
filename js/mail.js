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
    document.querySelectorAll("[data-mail-unread]").forEach((badge) => {
      badge.hidden = count === 0;
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
      ${campaign.url ? `<a class="sponsored-cta" href="${escapeHtml(campaign.url)}" target="_blank" rel="noopener noreferrer sponsored">${escapeHtml(campaign.cta)}</a>` : `<span class="sponsored-cta disabled" aria-disabled="true">${escapeHtml(campaign.cta)} · LINK COMING SOON</span>`}
    `;
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
