"use strict";

(() => {
  const config = window.GIS_ANALYTICS_CONFIG || {};
  const endpoint = String(config.endpoint || "").replace(/\/$/, "");
  const debug = Boolean(config.debug) || ["localhost", "127.0.0.1"].includes(location.hostname);
  const disabled = navigator.globalPrivacyControl === true || navigator.doNotTrack === "1";
  const visitorKey = "gis.analytics.visitor";
  const sessionKey = "gis.analytics.session";
  const queueKey = "gis.analytics.queue";
  const inviteContextKey = "gis.analytics.invite-context";
  const maxQueue = 100;
  const sessionTimeout = 30 * 60 * 1000;
  const startedAt = Date.now();
  const seen = new Set();
  const appStarts = new Map();

  const allowedEvents = new Set([
    "first_visit", "returning_visit", "session_started", "session_ended",
    "page_loaded", "route_viewed", "time_on_site", "lock_screen_viewed",
    "swipe_up_attempted", "face_id_scan_started", "face_id_success",
    "face_id_failure", "face_id_access_granted", "access_granted", "access_denied",
    "passcode_screen_viewed", "passcode_attempt", "phone_unlocked",
    "phone_returned_to_lock_screen", "home_screen_viewed", "app_opened",
    "app_closed", "app_time_spent", "section_viewed", "item_opened",
    "external_link_clicked", "download_button_clicked", "download_requested",
    "download_completed", "album_viewed", "song_viewed", "song_play_started",
    "song_paused", "song_resumed", "song_skipped", "song_restarted",
    "song_playback_milestone", "song_completed", "music_file_downloaded",
    "next_song_selected", "previous_song_selected", "artwork_viewed",
    "image_enlarged", "artwork_downloaded", "mailbox_viewed",
    "mail_message_opened", "mail_message_closed", "mail_link_clicked",
    "mail_attachment_viewed", "mail_attachment_downloaded",
    "reply_or_contact_clicked", "message_thread_opened", "message_thread_closed",
    "message_reply_selected", "message_image_viewed", "message_link_clicked",
    "message_conversation_completed", "exposure_section_opened", "venue_viewed",
    "exposure_event_viewed", "trailer_started", "trailer_completed",
    "exposure_event_entered", "media_playback_started", "media_playback_paused",
    "media_playback_resumed", "media_playback_milestone", "exposure_event_completed",
    "rsvp_clicked", "ticket_link_clicked", "ticket_redeemed",
    "backstage_content_opened", "soundcheck_content_opened",
    "performance_clip_opened", "dj_invite_opened", "dj_invite_validated",
    "dj_invite_rejected", "dj_invite_expired", "authorized_recipient_recognized",
    "dj_phone_unlocked", "first_dj_visit", "repeat_dj_visit", "contact_link_clicked",
    "dj_home_screen_viewed", "music_version_selected", "song_repeat_played",
    "music_mp3_downloaded", "music_wav_downloaded", "music_clean_downloaded",
    "music_explicit_downloaded", "photo_folder_opened",
    "official_artwork_downloaded", "personalized_artwork_downloaded",
    "vertical_artwork_downloaded", "logo_downloaded", "press_image_downloaded",
    "dj_drop_request_clicked", "credential_status_viewed", "event_preview_clicked"
  ]);

  function uuid() {
    return crypto.randomUUID ? crypto.randomUUID() :
      `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
  }

  function safeParse(value, fallback) {
    try { return JSON.parse(value) ?? fallback; } catch { return fallback; }
  }

  function sanitize(value, depth = 0) {
    if (depth > 3 || value == null) return value == null ? null : undefined;
    if (typeof value === "string") return value.slice(0, 500);
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    if (typeof value === "boolean") return value;
    if (Array.isArray(value)) return value.slice(0, 20).map((item) => sanitize(item, depth + 1));
    if (typeof value !== "object") return undefined;
    const blocked = /pass(code|word)|secret|token|message(_| )?(text|content)|form(_| )?(text|content)|email_address|phone_number/i;
    return Object.fromEntries(Object.entries(value).slice(0, 40)
      .filter(([key]) => !blocked.test(key))
      .map(([key, item]) => [key.slice(0, 80), sanitize(item, depth + 1)])
      .filter(([, item]) => item !== undefined));
  }

  function getVisitor() {
    const existing = safeParse(localStorage.getItem(visitorKey), null);
    if (existing?.id && existing?.firstVisitAt) return { ...existing, returning: true };
    const visitor = { id: uuid(), firstVisitAt: new Date().toISOString(), visits: 0, lastVisitAt: null };
    localStorage.setItem(visitorKey, JSON.stringify(visitor));
    return { ...visitor, returning: false };
  }

  function getSession() {
    const existing = safeParse(sessionStorage.getItem(sessionKey), null);
    if (existing?.id && Date.now() - Number(existing.lastActiveAt || 0) < sessionTimeout) return existing;
    const session = { id: uuid(), startedAt: new Date().toISOString(), lastActiveAt: Date.now() };
    sessionStorage.setItem(sessionKey, JSON.stringify(session));
    return session;
  }

  const visitor = getVisitor();
  const session = getSession();
  const params = new URLSearchParams(location.search);
  let settleInviteReady;
  const inviteReady = new Promise((resolve) => { settleInviteReady = resolve; });
  let inviteContext = safeParse(sessionStorage.getItem(inviteContextKey), null);
  let accessType = inviteContext?.accessType || "public";
  let inviteValidationPending = Boolean(params.get("invite") && endpoint && !inviteContext);
  if (!params.get("invite") || inviteContext) settleInviteReady();

  function campaign() {
    return {
      utm_source: params.get("utm_source"),
      utm_medium: params.get("utm_medium"),
      utm_campaign: params.get("utm_campaign")
    };
  }

  function device() {
    const ua = navigator.userAgent;
    const width = Math.min(screen.width, screen.height);
    return {
      device_category: /Mobi|Android|iPhone|iPad/i.test(ua) ? (width >= 768 ? "tablet" : "mobile") : "desktop",
      browser: /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Other",
      operating_system: /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Mac OS/.test(ua) ? "macOS" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "Other",
      screen_size: `${screen.width}x${screen.height}`
    };
  }

  function common() {
    return {
      event_id: uuid(),
      anonymous_visitor_id: visitor.id,
      session_id: session.id,
      access_type: accessType,
      invite_id: inviteContext?.inviteId || null,
      recipient_id: inviteContext?.recipientId || null,
      recipient_display_name: inviteContext?.recipientDisplayName || null,
      page: location.pathname,
      route: `${location.pathname}${location.hash}`,
      referrer: document.referrer || null,
      first_visit_timestamp: visitor.firstVisitAt,
      session_start_timestamp: session.startedAt,
      event_timestamp: new Date().toISOString(),
      is_returning: visitor.returning,
      visit_number: visitor.visits + 1,
      ...device(),
      ...campaign()
    };
  }

  function readQueue() {
    return safeParse(localStorage.getItem(queueKey), []).filter((item) => item?.event_name);
  }

  function saveQueue(queue) {
    try { localStorage.setItem(queueKey, JSON.stringify(queue.slice(-maxQueue))); } catch { /* Storage may be unavailable. */ }
  }

  function log(event) {
    if (debug) console.info("[Ghosts In Shells analytics]", event);
    window.dispatchEvent(new CustomEvent("gis:analytics", { detail: event }));
  }

  async function send(events, beacon = false) {
    if (disabled || !endpoint || !events.length) return false;
    const payload = JSON.stringify({ events, invite_context_token: inviteContext?.contextToken || null });
    if (beacon && navigator.sendBeacon) {
      return navigator.sendBeacon(`${endpoint}/v1/events`, new Blob([payload], { type: "application/json" }));
    }
    const response = await fetch(`${endpoint}/v1/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true
    });
    if (!response.ok) throw new Error("Analytics request rejected");
    return true;
  }

  async function flush() {
    const queue = readQueue();
    if (!queue.length || disabled || !endpoint || inviteValidationPending) return;
    try {
      await send(queue.slice(0, 25));
      saveQueue(queue.slice(25));
      if (queue.length > 25) window.setTimeout(flush, 250);
    } catch { /* Retain the queue for a later retry. */ }
  }

  async function requestPrivateAsset(assetId) {
    if (!endpoint || !inviteContext?.contextToken || accessType !== "DJ") {
      throw new Error("Authorized download context is unavailable.");
    }
    if (!/^[a-z0-9-]{3,80}$/.test(String(assetId || ""))) {
      throw new Error("Invalid asset request.");
    }
    const response = await fetch(`${endpoint}/v1/downloads/${assetId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invite_context_token: inviteContext.contextToken })
    });
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw new Error(result.error === "rate_limited"
        ? "Download limit reached. Please wait one minute and try again."
        : "This protected asset is unavailable.");
    }
    return {
      blob: await response.blob(),
      filename: response.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] || "download"
    };
  }

  function trackEvent(eventName, properties = {}, options = {}) {
    if (disabled || !allowedEvents.has(eventName)) return null;
    const dedupeKey = options.dedupeKey ? `${eventName}:${options.dedupeKey}` : null;
    if (dedupeKey && seen.has(dedupeKey)) return null;
    if (dedupeKey) seen.add(dedupeKey);
    session.lastActiveAt = Date.now();
    sessionStorage.setItem(sessionKey, JSON.stringify(session));
    const event = { event_name: eventName, ...common(), metadata: sanitize(properties) };
    log(event);
    const queue = readQueue();
    queue.push(event);
    saveQueue(queue);
    window.setTimeout(flush, 0);
    return event.event_id;
  }

  async function validateInvite() {
    const token = params.get("invite");
    if (!token || disabled) {
      settleInviteReady();
      return;
    }
    if (!endpoint) {
      if (debug) console.info("[Ghosts In Shells analytics] Invite present; validation requires an analytics endpoint.");
      settleInviteReady();
      return;
    }
    try {
      const response = await fetch(`${endpoint}/v1/invites/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token })
      });
      const result = await response.json();
      if (!response.ok || !result.valid) {
        inviteValidationPending = false;
        trackEvent(result.reason === "expired" ? "dj_invite_expired" : "dj_invite_rejected");
        window.dispatchEvent(new CustomEvent("gis:invite-rejected", { detail: { reason: result.reason || "invalid" } }));
        flush();
        return;
      }
      inviteContext = {
        ...result.context,
        isFirstVisit: Boolean(result.isFirstVisit)
      };
      accessType = inviteContext.accessType;
      sessionStorage.setItem(inviteContextKey, JSON.stringify(inviteContext));
      inviteValidationPending = false;
      trackEvent("dj_invite_opened", {}, { dedupeKey: inviteContext.inviteId });
      trackEvent("dj_invite_validated", {}, { dedupeKey: inviteContext.inviteId });
      trackEvent("authorized_recipient_recognized", {}, { dedupeKey: inviteContext.recipientId });
      trackEvent(result.isFirstVisit ? "first_dj_visit" : "repeat_dj_visit");
      window.dispatchEvent(new CustomEvent("gis:invite-validated", {
        detail: {
          accessType: inviteContext.accessType,
          accessLevel: inviteContext.accessLevel,
          recipientDisplayName: inviteContext.recipientDisplayName
        }
      }));
      flush();
    } catch {
      inviteValidationPending = false;
      flush();
      /* The public phone remains available if validation is offline. */
    } finally {
      settleInviteReady();
    }
  }

  function appOpened(appName) {
    const key = String(appName || "").toLowerCase();
    appStarts.set(key, Date.now());
    trackEvent("app_opened", { app_name: key });
  }

  function appClosed(appName) {
    const key = String(appName || "").toLowerCase();
    const openedAt = appStarts.get(key);
    trackEvent("app_closed", { app_name: key });
    if (openedAt) trackEvent("app_time_spent", { app_name: key, duration_seconds: Math.round((Date.now() - openedAt) / 1000) });
    appStarts.delete(key);
  }

  visitor.visits += 1;
  visitor.lastVisitAt = new Date().toISOString();
  localStorage.setItem(visitorKey, JSON.stringify(visitor));

  window.GISAnalytics = Object.freeze({
    trackEvent, flush, appOpened, appClosed, requestPrivateAsset,
    context: () => ({ accessType, inviteContext, visitorId: visitor.id, sessionId: session.id }),
    inviteReady,
    disabled
  });

  trackEvent(visitor.returning ? "returning_visit" : "first_visit", {}, { dedupeKey: session.id });
  trackEvent("session_started", {}, { dedupeKey: session.id });
  trackEvent("page_loaded", {}, { dedupeKey: location.href });
  trackEvent("route_viewed", {}, { dedupeKey: `${location.pathname}${location.hash}` });
  window.addEventListener("hashchange", () => trackEvent("route_viewed", { route: `${location.pathname}${location.hash}` }));
  window.addEventListener("online", flush);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      const seconds = Math.round((Date.now() - startedAt) / 1000);
      trackEvent("time_on_site", { duration_seconds: seconds });
      const queued = readQueue();
      if (queued.length && send(queued.slice(0, 25), true)) saveQueue(queued.slice(25));
    }
  });
  window.addEventListener("pagehide", () => {
    trackEvent("session_ended", { duration_seconds: Math.round((Date.now() - startedAt) / 1000) });
    const queued = readQueue();
    if (queued.length && send(queued.slice(0, 25), true)) saveQueue(queued.slice(25));
  });

  validateInvite();
  flush();
})();
