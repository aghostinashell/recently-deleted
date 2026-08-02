import { sha256 } from "./security.js";

const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const ACTIONS = new Set(["disable", "enable", "revoke", "reset-device"]);
const CATEGORIES = new Set(["music", "artwork", "mail", "exposure", "files"]);
const json = (data, status, headers) => new Response(JSON.stringify(data), {
  status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "private, no-store", ...headers }
});
const bearer = (request) => (request.headers.get("Authorization") || "").replace(/^Bearer /, "");
const readBody = async (request) => {
  const text = await request.text();
  if (new TextEncoder().encode(text).length > 16384) throw new Error("body_too_large");
  return JSON.parse(text || "{}");
};
function equal(left, right) {
  if (!left || !right || left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return mismatch === 0;
}
async function audit(env, action, targetType = null, targetId = null, details = {}) {
  await env.DB.prepare(`INSERT INTO owner_audit_log
    (id, action, target_type, target_id, details_json, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .bind(crypto.randomUUID(), action, targetType, targetId, JSON.stringify(details), new Date().toISOString()).run();
}
async function requireOwner(request, env) {
  const token = bearer(request);
  if (token.length < 32 || token.length > 256) return null;
  const session = await env.DB.prepare(`SELECT id, expires_at FROM owner_sessions
    WHERE token_hash = ? AND revoked_at IS NULL`).bind(await sha256(token)).first();
  if (!session || Date.parse(session.expires_at) <= Date.now()) return null;
  await env.DB.prepare("UPDATE owner_sessions SET last_seen_at = ? WHERE id = ?")
    .bind(new Date().toISOString(), session.id).run();
  return session;
}
async function login(request, env, headers, rateLimited) {
  if (!env.OWNER_PASSCODE_HASH) return json({ error: "owner_access_unavailable" }, 503, headers);
  if (await rateLimited(request, env, "OWNER_AUTH_RATE_LIMITER", 8)) return json({ error: "access_denied" }, 429, headers);
  const { passcode } = await readBody(request);
  if (!equal(await sha256(String(passcode || "")), env.OWNER_PASSCODE_HASH)) return json({ error: "access_denied" }, 401, headers);
  const token = `${crypto.randomUUID()}${crypto.randomUUID()}`.replaceAll("-", "");
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_TTL_MS);
  await env.DB.prepare(`INSERT INTO owner_sessions
    (id, token_hash, created_at, last_seen_at, expires_at) VALUES (?, ?, ?, ?, ?)`)
    .bind(crypto.randomUUID(), await sha256(token), now.toISOString(), now.toISOString(), expires.toISOString()).run();
  await audit(env, "owner_login");
  return json({ authenticated: true, token, expires_at: expires.toISOString() }, 200, headers);
}
async function diagnostics(env, headers) {
  const [sessions, visitors, breakdown, last] = await Promise.all([
    env.DB.prepare(`SELECT COUNT(*) AS active_sessions FROM analytics_sessions
      WHERE started_at >= datetime('now','-30 minutes') AND (ended_at IS NULL OR ended_at >= datetime('now','-30 minutes'))`).first(),
    env.DB.prepare("SELECT COUNT(*) AS visitors FROM anonymous_visitors").first(),
    env.DB.prepare(`SELECT access_type, COUNT(*) AS count FROM analytics_sessions
      WHERE started_at >= datetime('now','-30 minutes') GROUP BY access_type`).all(),
    env.DB.prepare("SELECT MAX(received_at) AS last_event_at FROM analytics_events").first()
  ]);
  return json({ status: "ONLINE", environment: env.ENVIRONMENT || "unknown",
    worker_version: env.WORKER_VERSION || "owner-phone",
    active_sessions: Number(sessions?.active_sessions || 0),
    total_anonymous_visitors: Number(visitors?.visitors || 0),
    current_user_breakdown: breakdown.results || [], last_event_at: last?.last_event_at || null,
    services: { worker: "operational", d1: "operational", r2: env.DJ_PRIVATE_ASSETS ? "bound" : "unbound" }
  }, 200, headers);
}
async function analytics(env, headers) {
  const [totals, events, songs, assets, referrers, recent] = await Promise.all([
    env.DB.prepare(`SELECT
      COUNT(DISTINCT CASE WHEN event_timestamp >= date('now') THEN anonymous_visitor_id END) visits_today,
      COUNT(DISTINCT CASE WHEN event_timestamp >= datetime('now','-30 minutes') THEN session_id END) online_now,
      COUNT(DISTINCT CASE WHEN is_returning=1 AND event_timestamp >= date('now') THEN anonymous_visitor_id END) returning_today
      FROM analytics_events WHERE is_test=0`).first(),
    env.DB.prepare(`SELECT event_name, COUNT(*) count FROM analytics_events WHERE is_test=0
      AND event_timestamp >= date('now') GROUP BY event_name ORDER BY count DESC`).all(),
    env.DB.prepare(`SELECT COALESCE(content_title,content_id,'Unknown') title, COUNT(*) count FROM analytics_events
      WHERE is_test=0 AND event_name IN ('song_play_started','song_completed')
      GROUP BY COALESCE(content_title,content_id,'Unknown') ORDER BY count DESC LIMIT 8`).all(),
    env.DB.prepare(`SELECT COALESCE(content_title,content_id,'Unknown') title, COUNT(*) count FROM analytics_events
      WHERE is_test=0 AND event_name LIKE '%download%' GROUP BY COALESCE(content_title,content_id,'Unknown')
      ORDER BY count DESC LIMIT 8`).all(),
    env.DB.prepare(`SELECT COALESCE(NULLIF(referrer,''),'Direct') referrer, COUNT(*) count FROM analytics_sessions
      WHERE is_test=0 GROUP BY COALESCE(NULLIF(referrer,''),'Direct') ORDER BY count DESC LIMIT 8`).all(),
    env.DB.prepare(`SELECT event_name,access_type,content_title,event_timestamp FROM analytics_events
      WHERE is_test=0 ORDER BY event_timestamp DESC LIMIT 30`).all()
  ]);
  return json({ totals: { online_now: Number(totals?.online_now || 0), visits_today: Number(totals?.visits_today || 0),
    returning_today: Number(totals?.returning_today || 0) }, event_counts: events.results || [],
    active_songs: songs.results || [], active_assets: assets.results || [], referrers: referrers.results || [],
    recent_activity: recent.results || [] }, 200, headers);
}
async function credentials(env, headers) {
  const result = await env.DB.prepare(`SELECT i.id,r.display_name recipient,i.access_type,r.access_level,
    i.created_at issued_at,i.last_used_at,i.total_visits,i.expires_at,i.disabled_at,i.revoked_at,
    (SELECT COUNT(*) FROM analytics_sessions s WHERE s.invite_id=i.id) sessions,
    (SELECT COUNT(*) FROM analytics_events e WHERE e.invite_id=i.id AND e.event_name='song_play_started') song_plays,
    (SELECT COUNT(*) FROM private_asset_downloads d WHERE d.invite_id=i.id) downloads
    FROM access_invites i JOIN invite_recipients r ON r.id=i.recipient_id ORDER BY i.created_at DESC`).all();
  return json({ credentials: (result.results || []).map((item) => ({ ...item,
    status: item.revoked_at ? "revoked" : item.disabled_at ? "disabled" :
      item.expires_at && Date.parse(item.expires_at) < Date.now() ? "expired" : "active"
  })) }, 200, headers);
}
async function issueCredential(request, env, headers) {
  const input = await readBody(request);
  const recipient = String(input.recipient || "").trim().slice(0, 120);
  const accessType = ["DJ", "media", "venue"].includes(input.access_type) ? input.access_type : "";
  if (!recipient || !accessType) return json({ error: "invalid_credential" }, 400, headers);
  const recipientId = crypto.randomUUID();
  const inviteId = crypto.randomUUID();
  const token = `${crypto.randomUUID()}${crypto.randomUUID()}`.replaceAll("-", "");
  const now = new Date().toISOString();
  const expires = input.expires_at && !Number.isNaN(Date.parse(input.expires_at)) ? new Date(input.expires_at).toISOString() : null;
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO invite_recipients
      (id,display_name,access_level,is_test,created_at) VALUES (?,?,?,?,?)`)
      .bind(recipientId, recipient, String(input.access_level || "All Access").slice(0, 80), 0, now),
    env.DB.prepare(`INSERT INTO access_invites
      (id,recipient_id,token_hash,access_type,expires_at,is_test,created_at) VALUES (?,?,?,?,?,?,?)`)
      .bind(inviteId, recipientId, await sha256(token), accessType, expires, 0, now)
  ]);
  await audit(env, "credential_issued", "credential", inviteId, { access_type: accessType });
  const route = accessType === "DJ" ? "/djparislife/" : "/";
  return json({ credential_id: inviteId, recipient, access_type: accessType,
    invite_url: `https://ghostsinshells.com${route}?invite=${token}` }, 201, headers);
}
async function mutate(env, id, action, headers) {
  if (!ACTIONS.has(action)) return json({ error: "invalid_action" }, 400, headers);
  if (!await env.DB.prepare("SELECT id FROM access_invites WHERE id=?").bind(id).first()) return json({ error: "not_found" }, 404, headers);
  if (action === "disable") await env.DB.prepare("UPDATE access_invites SET disabled_at=? WHERE id=?").bind(new Date().toISOString(), id).run();
  if (action === "enable") await env.DB.prepare("UPDATE access_invites SET disabled_at=NULL WHERE id=? AND revoked_at IS NULL").bind(id).run();
  if (action === "revoke") await env.DB.prepare("UPDATE access_invites SET revoked_at=? WHERE id=?").bind(new Date().toISOString(), id).run();
  if (action === "reset-device") await env.DB.prepare(`UPDATE access_invites SET authorization_version=authorization_version+1,
    total_visits=0,first_used_at=NULL,last_used_at=NULL WHERE id=?`).bind(id).run();
  await audit(env, `credential_${action}`, "credential", id);
  return json({ ok: true, action, credential_id: id }, 200, headers);
}
async function content(env, headers) {
  const [tracks, assets, exposure, metadata] = await Promise.all([
    env.DB.prepare("SELECT id,title,album_title,version,file_format,is_active FROM music_tracks ORDER BY title").all(),
    env.DB.prepare("SELECT id,title,category,file_type,is_active FROM downloadable_assets ORDER BY category,title").all(),
    env.DB.prepare("SELECT id,title,starts_at,is_active FROM exposure_events ORDER BY starts_at DESC").all(),
    env.DB.prepare("SELECT id,category,title,status,notes,updated_at FROM owner_content_metadata ORDER BY updated_at DESC").all()
  ]);
  return json({ tracks: tracks.results || [], assets: assets.results || [], exposure: exposure.results || [], metadata: metadata.results || [] }, 200, headers);
}
async function saveContent(request, env, headers) {
  const input = await readBody(request);
  if (!CATEGORIES.has(input.category) || !String(input.title || "").trim()) return json({ error: "invalid_content" }, 400, headers);
  const id = String(input.id || crypto.randomUUID()).slice(0, 120);
  const status = ["draft", "active", "archived"].includes(input.status) ? input.status : "draft";
  await env.DB.prepare(`INSERT INTO owner_content_metadata (id,category,title,status,notes,updated_at)
    VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET category=excluded.category,title=excluded.title,
    status=excluded.status,notes=excluded.notes,updated_at=excluded.updated_at`)
    .bind(id, input.category, String(input.title).trim().slice(0, 160), status,
      String(input.notes || "").slice(0, 1000), new Date().toISOString()).run();
  await audit(env, "content_metadata_saved", "content", id, { category: input.category, status });
  return json({ ok: true, id }, 200, headers);
}
async function logs(env, headers) {
  const result = await env.DB.prepare(`SELECT id,action,target_type,target_id,details_json,created_at
    FROM owner_audit_log ORDER BY created_at DESC LIMIT 200`).all();
  return json({ logs: result.results || [] }, 200, headers);
}
export async function handleOwner(request, env, headers, rateLimited) {
  const url = new URL(request.url);
  if (url.pathname === "/v1/owner/login" && request.method === "POST") return login(request, env, headers, rateLimited);
  const session = await requireOwner(request, env);
  if (!session) return json({ error: "unauthorized" }, 401, headers);
  if (url.pathname === "/v1/owner/logout" && request.method === "POST") {
    await env.DB.prepare("UPDATE owner_sessions SET revoked_at=? WHERE id=?").bind(new Date().toISOString(), session.id).run();
    return json({ ok: true }, 200, headers);
  }
  if (url.pathname === "/v1/owner/diagnostics" && request.method === "GET") return diagnostics(env, headers);
  if (url.pathname === "/v1/owner/analytics" && request.method === "GET") return analytics(env, headers);
  if (url.pathname === "/v1/owner/credentials" && request.method === "GET") return credentials(env, headers);
  if (url.pathname === "/v1/owner/credentials" && request.method === "POST") return issueCredential(request, env, headers);
  if (url.pathname === "/v1/owner/content" && request.method === "GET") return content(env, headers);
  if (url.pathname === "/v1/owner/content" && request.method === "POST") return saveContent(request, env, headers);
  if (url.pathname === "/v1/owner/logs" && request.method === "GET") return logs(env, headers);
  const activity = url.pathname.match(/^\/v1\/owner\/credentials\/([^/]+)\/activity$/);
  if (activity && request.method === "GET") {
    const result = await env.DB.prepare(`SELECT event_name,content_title,access_type,event_timestamp FROM analytics_events
      WHERE invite_id=? ORDER BY event_timestamp DESC LIMIT 100`).bind(decodeURIComponent(activity[1])).all();
    return json({ activity: result.results || [] }, 200, headers);
  }
  const mutation = url.pathname.match(/^\/v1\/owner\/credentials\/([^/]+)\/(disable|enable|revoke|reset-device)$/);
  if (mutation && request.method === "POST") return mutate(env, decodeURIComponent(mutation[1]), mutation[2], headers);
  if (url.pathname === "/v1/owner/push" && request.method === "POST") {
    return json({ error: "delivery_not_configured", message: "Push delivery is not enabled." }, 501, headers);
  }
  return json({ error: "not_found" }, 404, headers);
}
