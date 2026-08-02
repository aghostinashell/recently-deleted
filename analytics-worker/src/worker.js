import { ACCESS_TYPES, ALLOWED_EVENTS } from "./events.js";
import { sanitizeMetadata, sha256, signContext, verifyContext } from "./security.js";

const fallbackBuckets = new Map();
const MAX_BODY_BYTES = 64 * 1024;

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers }
  });
}

function cors(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowed = String(env.ALLOWED_ORIGINS || "").split(",").map((item) => item.trim());
  return allowed.includes(origin) ? {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, GET, DELETE, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  } : {};
}

function originAllowed(request, env) {
  const origin = request.headers.get("Origin");
  if (!origin) return true;
  return String(env.ALLOWED_ORIGINS || "").split(",").map((item) => item.trim()).includes(origin);
}

async function rateLimited(request, env, bindingName, fallbackLimit, actorKey = "") {
  const key = actorKey || request.headers.get("CF-Connecting-IP") || "local";
  if (env[bindingName]?.limit) {
    const result = await env[bindingName].limit({ key });
    return !result.success;
  }
  const minute = Math.floor(Date.now() / 60000);
  const bucketKey = `${bindingName}:${key}`;
  const current = fallbackBuckets.get(bucketKey);
  if (!current || current.minute !== minute) {
    fallbackBuckets.set(bucketKey, { minute, count: 1 });
    return false;
  }
  current.count += 1;
  return current.count > fallbackLimit;
}

function adminAuthorized(request, env) {
  const supplied = request.headers.get("Authorization") || "";
  return env.ADMIN_API_TOKEN && supplied === `Bearer ${env.ADMIN_API_TOKEN}`;
}

async function parseBody(request) {
  const length = Number(request.headers.get("Content-Length") || 0);
  if (length > MAX_BODY_BYTES) throw new Error("body_too_large");
  const text = await request.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) throw new Error("body_too_large");
  return JSON.parse(text || "{}");
}

async function validateInvite(request, env, headers) {
  const { token } = await parseBody(request);
  if (typeof token !== "string" || token.length < 32 || token.length > 256) {
    return json({ valid: false, reason: "invalid" }, 400, headers);
  }
  const tokenHash = await sha256(token);
  if (await rateLimited(request, env, "INVITES_RATE_LIMITER", 30, tokenHash.slice(0, 24))) {
    return json({ valid: false, reason: "rate_limited" }, 429, headers);
  }
  const invite = await env.DB.prepare(`
    SELECT i.id, i.access_type, i.expires_at, i.revoked_at, i.is_test, i.total_visits,
           r.id AS recipient_id, r.display_name, r.access_level
    FROM access_invites i JOIN invite_recipients r ON r.id = i.recipient_id
    WHERE i.token_hash = ?
  `).bind(tokenHash).first();
  if (!invite || invite.revoked_at) return json({ valid: false, reason: "invalid" }, 404, headers);
  if (invite.expires_at && Date.parse(invite.expires_at) < Date.now()) {
    return json({ valid: false, reason: "expired" }, 410, headers);
  }
  const now = new Date().toISOString();
  await env.DB.prepare(`
    UPDATE access_invites SET total_visits = total_visits + 1,
      first_used_at = COALESCE(first_used_at, ?), last_used_at = ? WHERE id = ?
  `).bind(now, now, invite.id).run();
  const contextToken = await signContext({
    inviteId: invite.id,
    recipientId: invite.recipient_id,
    recipientDisplayName: invite.display_name,
    accessType: invite.access_type,
    accessLevel: invite.access_level,
    isTest: Boolean(invite.is_test),
    expiresAt: Date.now() + 12 * 60 * 60 * 1000
  }, env.INVITE_SIGNING_SECRET);
  return json({
    valid: true,
    isFirstVisit: invite.total_visits === 0,
    context: {
      inviteId: invite.id,
      recipientId: invite.recipient_id,
      recipientDisplayName: invite.display_name,
      accessType: invite.access_type,
      accessLevel: invite.access_level,
      isTest: Boolean(invite.is_test),
      contextToken
    }
  }, 200, headers);
}

async function collectEvents(request, env, headers) {
  const body = await parseBody(request);
  const events = Array.isArray(body.events) ? body.events.slice(0, 25) : [];
  if (!events.length) return json({ error: "events_required" }, 400, headers);
  const actorKey = String(events[0]?.anonymous_visitor_id || "");
  if (await rateLimited(request, env, "EVENTS_RATE_LIMITER", 120, actorKey)) {
    return json({ error: "rate_limited" }, 429, headers);
  }
  const context = await verifyContext(body.invite_context_token, env.INVITE_SIGNING_SECRET);
  const statements = [];
  for (const event of events) {
    if (!event || !ALLOWED_EVENTS.has(event.event_name)) return json({ error: "event_not_allowed" }, 400, headers);
    if (!/^[0-9a-f-]{16,64}$/i.test(String(event.event_id || "")) ||
        !/^[0-9a-z-]{16,100}$/i.test(String(event.anonymous_visitor_id || "")) ||
        !/^[0-9a-z-]{16,100}$/i.test(String(event.session_id || ""))) {
      return json({ error: "invalid_identifiers" }, 400, headers);
    }
    const accessType = context?.accessType || (ACCESS_TYPES.has(event.access_type) ? event.access_type : "public");
    const inviteId = context?.inviteId || null;
    const recipientId = context?.recipientId || null;
    const recipientName = context?.recipientDisplayName || null;
    const isTest = context?.isTest ? 1 : 0;
    const metadata = sanitizeMetadata(event.metadata || {});
    const metadataJson = JSON.stringify(metadata);
    if (metadataJson.length > 8192) return json({ error: "metadata_too_large" }, 400, headers);
    const location = request.cf || {};
    statements.push(
      env.DB.prepare(`INSERT INTO anonymous_visitors
        (id, first_visit_at, last_visit_at, total_visits, updated_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(id) DO UPDATE SET last_visit_at = excluded.last_visit_at,
          total_visits = MAX(anonymous_visitors.total_visits, excluded.total_visits),
          updated_at = CURRENT_TIMESTAMP`)
        .bind(event.anonymous_visitor_id, event.first_visit_timestamp, event.event_timestamp, Number(event.visit_number || 1)),
      env.DB.prepare(`INSERT INTO analytics_sessions
        (id, anonymous_visitor_id, access_type, invite_id, recipient_id, started_at,
         referrer, utm_source, utm_medium, utm_campaign, device_category, browser,
         operating_system, screen_size, country, region, city, is_test)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          access_type = CASE WHEN excluded.invite_id IS NOT NULL THEN excluded.access_type ELSE analytics_sessions.access_type END,
          invite_id = COALESCE(excluded.invite_id, analytics_sessions.invite_id),
          recipient_id = COALESCE(excluded.recipient_id, analytics_sessions.recipient_id),
          is_test = MAX(analytics_sessions.is_test, excluded.is_test)`)
        .bind(event.session_id, event.anonymous_visitor_id, accessType, inviteId, recipientId,
          event.session_start_timestamp, event.referrer, event.utm_source, event.utm_medium,
          event.utm_campaign, event.device_category, event.browser, event.operating_system,
          event.screen_size, location.country || null, location.region || null, location.city || null, isTest),
      env.DB.prepare(`INSERT OR IGNORE INTO analytics_events
        (id, event_name, anonymous_visitor_id, session_id, access_type, invite_id,
         recipient_id, recipient_display_name, app_name, content_id, content_title,
         page, route, referrer, device_category, browser, operating_system, screen_size,
         country, region, city, is_returning, metadata_json, event_timestamp, is_test)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(event.event_id, event.event_name, event.anonymous_visitor_id, event.session_id,
          accessType, inviteId, recipientId, recipientName, metadata.app_name || null,
          metadata.content_id || metadata.song_id || metadata.asset_id || null,
          metadata.content_title || metadata.song_title || metadata.asset_title || null,
          event.page, event.route, event.referrer, event.device_category, event.browser,
          event.operating_system, event.screen_size, location.country || null,
          location.region || null, location.city || null, event.is_returning ? 1 : 0,
          metadataJson, event.event_timestamp, isTest)
    );
    if (event.event_name === "session_ended") {
      statements.push(env.DB.prepare(`
        UPDATE analytics_sessions SET ended_at = ?, duration_seconds = ? WHERE id = ?
      `).bind(event.event_timestamp, Number(metadata.duration_seconds || 0), event.session_id));
    }
  }
  await env.DB.batch(statements);
  return json({ accepted: events.length }, 202, headers);
}

async function testEvents(request, env, headers) {
  if (env.TEST_MODE !== "true" || !adminAuthorized(request, env)) return json({ error: "not_found" }, 404, headers);
  const inviteId = new URL(request.url).searchParams.get("invite_id");
  if (!inviteId || !/^test-invite-[0-9a-f-]{36}$/i.test(inviteId)) {
    return json({ error: "test_invite_id_required" }, 400, headers);
  }
  const invite = await env.DB.prepare("SELECT id FROM access_invites WHERE id = ? AND is_test = 1").bind(inviteId).first();
  if (!invite) return json({ error: "test_invite_not_found" }, 404, headers);
  if (request.method === "DELETE") {
    await env.DB.batch([
      env.DB.prepare("DELETE FROM analytics_events WHERE is_test = 1 AND invite_id = ?").bind(inviteId),
      env.DB.prepare("DELETE FROM analytics_sessions WHERE is_test = 1 AND invite_id = ?").bind(inviteId),
      env.DB.prepare("UPDATE access_invites SET total_visits = 0, first_used_at = NULL, last_used_at = NULL WHERE id = ? AND is_test = 1").bind(inviteId)
    ]);
    return json({ reset: true, invite_id: inviteId }, 200, headers);
  }
  const result = await env.DB.prepare(`
    SELECT id, event_name, anonymous_visitor_id, session_id, access_type,
      invite_id, recipient_id, recipient_display_name, app_name,
      content_id, content_title, metadata_json, event_timestamp, received_at
    FROM analytics_events WHERE is_test = 1 AND invite_id = ?
    ORDER BY received_at DESC LIMIT 250
  `).bind(inviteId).all();
  return json({ events: result.results }, 200, headers);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const headers = cors(request, env);
    if (request.method === "OPTIONS") {
      return originAllowed(request, env)
        ? new Response(null, { status: 204, headers })
        : json({ error: "origin_not_allowed" }, 403);
    }
    if (url.pathname === "/health") return json({ ok: true }, 200, headers);
    const isAdminRoute = url.pathname === "/v1/test/events";
    if (!isAdminRoute && !request.headers.get("Origin")) return json({ error: "origin_required" }, 403, headers);
    if (!isAdminRoute && !originAllowed(request, env)) return json({ error: "origin_not_allowed" }, 403, headers);
    try {
      if (url.pathname === "/v1/invites/validate" && request.method === "POST") return await validateInvite(request, env, headers);
      if (url.pathname === "/v1/events" && request.method === "POST") return await collectEvents(request, env, headers);
      if (url.pathname === "/v1/test/events" && ["GET", "DELETE"].includes(request.method)) return await testEvents(request, env, headers);
      return json({ error: "not_found" }, 404, headers);
    } catch (error) {
      const status = error.message === "body_too_large" ? 413 : 400;
      return json({ error: status === 413 ? "body_too_large" : "invalid_request" }, status, headers);
    }
  }
};
