import test from "node:test";
import assert from "node:assert/strict";
import { handleOwner } from "../src/owner.js";
import { sha256 } from "../src/security.js";

const headers = { "Access-Control-Allow-Origin": "https://ghostsinshells.com" };
const request = (path, init = {}) => new Request(`https://worker.example/v1/owner${path}`, init);

function database(overrides = {}) {
  const writes = [];
  return {
    writes,
    async batch(statements) {
      for (const statement of statements) await statement.run();
      return statements.map(() => ({ success: true }));
    },
    prepare(sql) {
      const normalized = sql.replace(/\s+/g, " ").trim();
      let args = [];
      const statement = {
        bind(...values) { args = values; return statement; },
        async first() {
          if (normalized.includes("FROM owner_sessions")) return overrides.session ?? { id: "owner-session", expires_at: "2099-01-01T00:00:00.000Z" };
          if (normalized.startsWith("SELECT id FROM access_invites")) return overrides.credential ?? { id: args[0] };
          if (normalized.includes("active_sessions")) return { active_sessions: 2 };
          if (normalized.includes("COUNT(*) AS visitors")) return { visitors: 12 };
          if (normalized.includes("MAX(received_at)")) return { last_event_at: "2026-08-02T12:00:00Z" };
          if (normalized.includes("visits_today")) return { visits_today: 8, online_now: 2, returning_today: 3 };
          return null;
        },
        async all() {
          if (normalized.includes("FROM access_invites i JOIN invite_recipients")) return { results: [{
            id: "invite-1", recipient: "DJ Paris Life", access_type: "DJ", access_level: "All Access",
            issued_at: "2026-08-02", total_visits: 4, sessions: 2, song_plays: 5, downloads: 3
          }] };
          if (normalized.includes("FROM owner_audit_log")) return { results: [{ action: "owner_login" }] };
          if (normalized.includes("FROM music_tracks")) return { results: [{ id: "track-1", title: "Amber" }] };
          return { results: [] };
        },
        async run() { writes.push({ sql: normalized, args }); return { success: true }; }
      };
      return statement;
    }
  };
}

async function ownerEnv(overrides = {}) {
  return {
    OWNER_PASSCODE_HASH: await sha256("2468"),
    DB: database(),
    ENVIRONMENT: "test",
    WORKER_VERSION: "test-version",
    ...overrides
  };
}

test("owner authentication fails closed and returns only Access Denied semantics", async () => {
  const env = await ownerEnv();
  const response = await handleOwner(request("/login", {
    method: "POST", body: JSON.stringify({ passcode: "wrong" })
  }), env, headers, async () => false);
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "access_denied" });
  assert.equal(env.DB.writes.length, 0);
});

test("owner authentication stores only a token hash and returns a bounded session", async () => {
  const env = await ownerEnv();
  const response = await handleOwner(request("/login", {
    method: "POST", body: JSON.stringify({ passcode: "2468" })
  }), env, headers, async () => false);
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.authenticated, true);
  assert.ok(result.token.length >= 64);
  const insert = env.DB.writes.find((write) => write.sql.includes("INSERT INTO owner_sessions"));
  assert.ok(insert);
  assert.notEqual(insert.args[1], result.token);
  assert.equal(insert.args[1], await sha256(result.token));
  assert.equal(JSON.stringify(env.DB.writes).includes("2468"), false);
});

test("protected owner routes reject missing sessions", async () => {
  const env = await ownerEnv({ DB: database({ session: null }) });
  const response = await handleOwner(request("/diagnostics"), env, headers, async () => false);
  assert.equal(response.status, 401);
});

test("owner diagnostics, analytics, credentials and content are server-backed", async () => {
  const env = await ownerEnv();
  const auth = { Authorization: `Bearer ${"a".repeat(64)}` };
  assert.equal((await handleOwner(request("/diagnostics", { headers: auth }), env, headers)).status, 200);
  assert.equal((await handleOwner(request("/analytics", { headers: auth }), env, headers)).status, 200);
  const credentials = await (await handleOwner(request("/credentials", { headers: auth }), env, headers)).json();
  assert.equal(credentials.credentials[0].recipient, "DJ Paris Life");
  assert.equal("token_hash" in credentials.credentials[0], false);
  const content = await (await handleOwner(request("/content", { headers: auth }), env, headers)).json();
  assert.equal(content.tracks[0].title, "Amber");
});

test("credential disable and reset are audited without exposing invite tokens", async () => {
  const env = await ownerEnv();
  const auth = { Authorization: `Bearer ${"a".repeat(64)}`, "Content-Type": "application/json" };
  for (const action of ["disable", "reset-device"]) {
    const response = await handleOwner(request(`/credentials/invite-1/${action}`, { method: "POST", headers: auth, body: "{}" }), env, headers);
    assert.equal(response.status, 200);
  }
  assert.ok(env.DB.writes.some((write) => write.sql.includes("disabled_at")));
  assert.ok(env.DB.writes.some((write) => write.sql.includes("authorization_version")));
  assert.ok(env.DB.writes.filter((write) => write.sql.includes("owner_audit_log")).length >= 2);
  assert.equal(JSON.stringify(env.DB.writes).includes("token_hash ="), false);
});

test("credential issuance returns a one-time link while D1 receives only its hash", async () => {
  const env = await ownerEnv();
  const auth = { Authorization: `Bearer ${"a".repeat(64)}`, "Content-Type": "application/json" };
  const response = await handleOwner(request("/credentials", {
    method: "POST", headers: auth, body: JSON.stringify({ recipient: "Test DJ", access_type: "DJ" })
  }), env, headers);
  assert.equal(response.status, 201);
  const result = await response.json();
  assert.match(result.invite_url, /^https:\/\/ghostsinshells\.com\/djparislife\/\?invite=[0-9a-f]{64}$/);
  const rawToken = new URL(result.invite_url).searchParams.get("invite");
  const inviteInsert = env.DB.writes.find((write) => write.sql.includes("INSERT INTO access_invites"));
  assert.equal(inviteInsert.args[2], await sha256(rawToken));
  assert.equal(JSON.stringify(env.DB.writes).includes(rawToken), false);
});

test("content metadata is validated and push delivery never pretends to send", async () => {
  const env = await ownerEnv();
  const auth = { Authorization: `Bearer ${"a".repeat(64)}`, "Content-Type": "application/json" };
  const saved = await handleOwner(request("/content", {
    method: "POST", headers: auth, body: JSON.stringify({ category: "music", title: "New master", status: "draft" })
  }), env, headers);
  assert.equal(saved.status, 200);
  const push = await handleOwner(request("/push", { method: "POST", headers: auth, body: "{}" }), env, headers);
  assert.equal(push.status, 501);
});
