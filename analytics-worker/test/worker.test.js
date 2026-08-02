import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/worker.js";
import { signContext } from "../src/security.js";

const origin = "https://ghostsinshells.com";
const baseEnv = {
  ALLOWED_ORIGINS: origin,
  TEST_MODE: "true",
  INVITE_SIGNING_SECRET: "test-signing-secret",
  ADMIN_API_TOKEN: "test-admin-token",
  EVENTS_RATE_LIMITER: { limit: async () => ({ success: true }) },
  INVITES_RATE_LIMITER: { limit: async () => ({ success: true }) },
  DOWNLOADS_RATE_LIMITER: { limit: async () => ({ success: true }) }
};

function request(path, init = {}) {
  return new Request(`https://analytics.example${path}`, init);
}

test("health is public but analytics reads are not", async () => {
  assert.equal((await worker.fetch(request("/health"), baseEnv)).status, 200);
  assert.equal((await worker.fetch(request("/v1/test/events"), baseEnv)).status, 404);
  assert.equal((await worker.fetch(request("/v1/unknown"), baseEnv)).status, 403);
});

test("public collection requires an approved origin", async () => {
  const body = JSON.stringify({ events: [{}] });
  assert.equal((await worker.fetch(request("/v1/events", { method: "POST", body }), baseEnv)).status, 403);
  assert.equal((await worker.fetch(request("/v1/events", {
    method: "POST",
    headers: { Origin: "https://evil.example" },
    body
  }), baseEnv)).status, 403);
});

test("malformed, oversized and unapproved events are rejected", async () => {
  const headers = { Origin: origin, "Content-Type": "application/json" };
  assert.equal((await worker.fetch(request("/v1/events", { method: "POST", headers, body: "{" }), baseEnv)).status, 400);
  assert.equal((await worker.fetch(request("/v1/events", {
    method: "POST",
    headers: { ...headers, "Content-Length": "70000" },
    body: "{}"
  }), baseEnv)).status, 413);
  const response = await worker.fetch(request("/v1/events", {
    method: "POST",
    headers,
    body: JSON.stringify({
      events: [{
        event_name: "not_allowed",
        event_id: "11111111-1111-4111-8111-111111111111",
        anonymous_visitor_id: "22222222-2222-4222-8222-222222222222",
        session_id: "33333333-3333-4333-8333-333333333333"
      }]
    })
  }), baseEnv);
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, "event_not_allowed");
});

test("rate-limit binding can reject event batches", async () => {
  const env = {
    ...baseEnv,
    EVENTS_RATE_LIMITER: { limit: async () => ({ success: false }) }
  };
  const response = await worker.fetch(request("/v1/events", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify({
      events: [{
        event_name: "page_loaded",
        event_id: "11111111-1111-4111-8111-111111111111",
        anonymous_visitor_id: "22222222-2222-4222-8222-222222222222",
        session_id: "33333333-3333-4333-8333-333333333333"
      }]
    })
  }), env);
  assert.equal(response.status, 429);
});

test("expired and revoked invites are rejected", async () => {
  const makeEnv = (invite) => ({
    ...baseEnv,
    DB: {
      prepare: () => ({
        bind: () => ({ first: async () => invite })
      })
    }
  });
  const init = {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify({ token: "a".repeat(43) })
  };
  const expired = await worker.fetch(request("/v1/invites/validate", init), makeEnv({
    id: "invite", expires_at: "2020-01-01T00:00:00.000Z", revoked_at: null
  }));
  assert.equal(expired.status, 410);
  const revoked = await worker.fetch(request("/v1/invites/validate", init), makeEnv({
    id: "invite", expires_at: null, revoked_at: "2026-01-01T00:00:00.000Z"
  }));
  assert.equal(revoked.status, 404);
});

test("valid DJ invite returns only signed safe credential context", async () => {
  const invite = {
    id: "test-invite-11111111-1111-4111-8111-111111111111",
    access_type: "DJ",
    expires_at: "2030-01-01T00:00:00.000Z",
    revoked_at: null,
    is_test: 1,
    total_visits: 0,
    issued_at: "2026-08-02T00:00:00.000Z",
    recipient_id: "test-recipient-22222222-2222-4222-8222-222222222222",
    display_name: "DJ Phone Test",
    access_level: "All Access Test",
    personalized_artwork_path: "media/dj/recipients/test/face-id-licensed-preview.jpg"
  };
  const env = {
    ...baseEnv,
    DB: {
      prepare: (sql) => ({
        bind: () => sql.includes("SELECT")
          ? { first: async () => invite }
          : { run: async () => ({ success: true }) }
      })
    }
  };
  const response = await worker.fetch(request("/v1/invites/validate", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify({ token: "a".repeat(43) })
  }), env);
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.context.recipientDisplayName, "DJ Phone Test");
  assert.equal(result.context.publicPassNumber, "11111111");
  assert.equal(result.context.personalizedArtworkAvailable, true);
  assert.equal("token" in result.context, false);
  assert.match(result.context.contextToken, /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
});

async function downloadContext(overrides = {}) {
  return signContext({
    inviteId: "test-invite-11111111-1111-4111-8111-111111111111",
    recipientId: "test-recipient-22222222-2222-4222-8222-222222222222",
    accessType: "DJ",
    isTest: true,
    expiresAt: Date.now() + 60_000,
    ...overrides
  }, baseEnv.INVITE_SIGNING_SECRET);
}

function downloadEnv(inviteOverrides = {}, envOverrides = {}) {
  const invite = {
    id: "test-invite-11111111-1111-4111-8111-111111111111",
    recipient_id: "test-recipient-22222222-2222-4222-8222-222222222222",
    access_type: "DJ",
    expires_at: "2030-01-01T00:00:00.000Z",
    revoked_at: null,
    is_test: 1,
    personalized_artwork_path: null,
    ...inviteOverrides
  };
  return {
    ...baseEnv,
    DB: {
      prepare: (sql) => ({
        bind: () => sql.includes("SELECT i.id")
          ? { first: async () => invite }
          : { run: async () => ({ success: true }) }
      })
    },
    DJ_PRIVATE_ASSETS: {
      get: async (key) => ({
        body: new TextEncoder().encode(`fixture:${key}`),
        size: 12,
        httpEtag: "\"fixture\""
      })
    },
    ...envOverrides
  };
}

function downloadRequest(assetId, contextToken) {
  return request(`/v1/downloads/${assetId}`, {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify({ invite_context_token: contextToken })
  });
}

test("authorized DJ download streams an allowlisted R2 object with a safe filename", async () => {
  const token = await downloadContext();
  const response = await worker.fetch(
    downloadRequest("face-id-explicit-mp3", token),
    downloadEnv(),
    { waitUntil: () => {} }
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Content-Type"), "audio/mpeg");
  assert.equal(response.headers.get("Cache-Control"), "private, no-store, max-age=0");
  assert.equal(response.headers.get("Content-Disposition"), "attachment; filename=\"Saint Ed X - Face ID (Explicit).mp3\"");
  assert.match(await response.text(), /^fixture:releases\/face-id\/masters\//);
});

test("private downloads reject invalid, expired, revoked, and non-DJ invites", async () => {
  const invalid = await worker.fetch(downloadRequest("face-id-explicit-mp3", "bad"), downloadEnv());
  assert.equal(invalid.status, 401);

  const token = await downloadContext();
  const expired = await worker.fetch(
    downloadRequest("face-id-explicit-mp3", token),
    downloadEnv({ expires_at: "2020-01-01T00:00:00.000Z" })
  );
  assert.equal(expired.status, 401);

  const revoked = await worker.fetch(
    downloadRequest("face-id-explicit-mp3", token),
    downloadEnv({ revoked_at: "2026-01-01T00:00:00.000Z" })
  );
  assert.equal(revoked.status, 401);

  const publicToken = await downloadContext({ accessType: "public" });
  const publicResponse = await worker.fetch(
    downloadRequest("face-id-explicit-mp3", publicToken),
    downloadEnv()
  );
  assert.equal(publicResponse.status, 401);
});

test("private downloads deny altered asset IDs, traversal, and personalized cross-recipient access", async () => {
  const token = await downloadContext();
  assert.equal((await worker.fetch(downloadRequest("face-id-explicit-mp4", token), downloadEnv())).status, 403);
  assert.equal((await worker.fetch(downloadRequest("../face-id-explicit-mp3", token), downloadEnv())).status, 404);
  assert.equal((await worker.fetch(
    downloadRequest("face-id-personalized-artwork", token),
    downloadEnv({ personalized_artwork_path: null })
  )).status, 403);
});

test("download rate limiting and missing objects fail closed", async () => {
  const token = await downloadContext();
  const rateLimited = await worker.fetch(
    downloadRequest("face-id-clean-wav", token),
    downloadEnv({}, { DOWNLOADS_RATE_LIMITER: { limit: async () => ({ success: false }) } })
  );
  assert.equal(rateLimited.status, 429);

  const missing = await worker.fetch(
    downloadRequest("face-id-clean-wav", token),
    downloadEnv({}, { DJ_PRIVATE_ASSETS: { get: async () => null } })
  );
  assert.equal(missing.status, 404);
});

test("download audit failure cannot block an authorized stream", async () => {
  const token = await downloadContext();
  const env = downloadEnv();
  env.DB.prepare = (sql) => ({
    bind: () => sql.includes("SELECT i.id")
      ? { first: async () => ({
        id: "test-invite-11111111-1111-4111-8111-111111111111",
        recipient_id: "test-recipient-22222222-2222-4222-8222-222222222222",
        access_type: "DJ",
        expires_at: null,
        revoked_at: null,
        is_test: 1,
        personalized_artwork_path: null
      }) }
      : { run: async () => { throw new Error("D1 unavailable"); } }
  });
  const response = await worker.fetch(downloadRequest("face-id-clean-mp3", token), env);
  assert.equal(response.status, 200);
});
