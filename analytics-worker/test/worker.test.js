import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/worker.js";

const origin = "https://ghostsinshells.com";
const baseEnv = {
  ALLOWED_ORIGINS: origin,
  TEST_MODE: "true",
  INVITE_SIGNING_SECRET: "test-signing-secret",
  ADMIN_API_TOKEN: "test-admin-token",
  EVENTS_RATE_LIMITER: { limit: async () => ({ success: true }) },
  INVITES_RATE_LIMITER: { limit: async () => ({ success: true }) }
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
