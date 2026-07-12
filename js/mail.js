"use strict";

(function createMailApp() {
  const DATA_URL = "data/mail/ads.json";
  const DELIVERED_KEY = "myphone.mail.delivered.v1";
  const UNREAD_KEY = "myphone.mail.unread.v1";
  const CURSOR_KEY = "myphone.mail.cursor.v1";
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
    localStorage.setItem(key, JSON.stringify([...new Set(value)]));
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
    const cursor = Number(localStorage.getItem(CURSOR_KEY) || 0) % campaigns.length;
    const campaign = campaigns[cursor];
    localStorage.setItem(CURSOR_KEY, String((cursor + 1) % campaigns.length));
    writeList(DELIVERED_KEY, [...readList(DELIVERED_KEY), campaign.id]);
    writeList(UNREAD_KEY, [...readList(UNREAD_KEY), campaign.id]);
    syncUnreadBadge();
    showNotification(campaign);
    remainingDelay = nextDelay();
    schedule(remainingDelay);
  }

  function showNotification(campaign) {
    let banner = document.getElementById("mailNotificationBanner");
    if (!banner) {
      banner = document.createElement("button");
      banner.id = "mailNotificationBanner";
      banner.className = "mail-notification-banner";
      banner.type = "button";
      document.getElementById("device")?.appendChild(banner);
    }
    banner.innerHTML = `<span class="mail-notification-icon">✉</span><span><small>MAIL · NOW</small><strong>${escapeHtml(campaign.subject)}</strong><p>${escapeHtml(campaign.preview)}</p></span>`;
    banner.onclick = () => openFromNotification(campaign.id);
    banner.classList.remove("visible", "leaving");
    void banner.offsetWidth;
    banner.classList.add("visible");
    window.setTimeout(() => {
      banner.classList.add("leaving");
      banner.classList.remove("visible");
    }, 6500);
  }

  function openFromNotification(id) {
    pendingCampaignId = id;
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

  function openEmail(host, campaign, campaigns) {
    writeList(UNREAD_KEY, readList(UNREAD_KEY).filter((id) => id !== campaign.id));
    syncUnreadBadge();
    host.innerHTML = `
      <article class="sponsored-email">
        <button class="mail-back" type="button" data-mail-back>‹ Inbox</button>
        <header class="sponsored-email-header"><span>${escapeHtml(campaign.label)}</span><h2>${escapeHtml(campaign.sender)}</h2><h1>${escapeHtml(campaign.headline)}</h1><p>To: Ed</p><time>${new Date().toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</time></header>
        <div class="sponsored-email-body">${renderEmailBody(campaign)}</div>
      </article>`;
    host.querySelector("[data-mail-back]").addEventListener("click", () => renderInbox(host, campaigns));
    document.getElementById("appWindow").scrollTop = 0;
  }

  function renderInbox(host, campaigns) {
    const delivered = readList(DELIVERED_KEY);
    const unread = readList(UNREAD_KEY);
    const inbox = delivered.map((id) => campaigns.find((campaign) => campaign.id === id)).filter(Boolean).reverse();
    host.innerHTML = `
      <section class="mail-inbox">
        <header><button type="button">Edit</button><h2>Inbox</h2><button type="button" aria-label="Compose">□</button></header>
        <div class="mail-inbox-list">${inbox.length ? inbox.map((campaign) => `<button class="mail-row ${unread.includes(campaign.id) ? "unread" : ""}" type="button" data-mail-id="${escapeHtml(campaign.id)}"><i></i><span><strong>${escapeHtml(campaign.sender)}</strong><time>Now</time><b>${escapeHtml(campaign.subject)}</b><p>${escapeHtml(campaign.preview)}</p><small>${escapeHtml(campaign.label)}</small></span><em>›</em></button>`).join("") : `<p class="empty-state">No sponsored mail yet.<br>The first message arrives after 45 active seconds.</p>`}</div>
      </section>`;
    host.querySelectorAll("[data-mail-id]").forEach((button) => button.addEventListener("click", () => {
      const campaign = campaigns.find((item) => item.id === button.dataset.mailId);
      if (campaign) openEmail(host, campaign, campaigns);
    }));
  }

  async function openInbox(host) {
    host.innerHTML = `<p class="app-loading">Loading Mail…</p>`;
    try {
      const campaigns = await getCampaigns();
      const requested = pendingCampaignId;
      pendingCampaignId = null;
      if (requested) {
        const campaign = campaigns.find((item) => item.id === requested);
        if (campaign) return openEmail(host, campaign, campaigns);
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
