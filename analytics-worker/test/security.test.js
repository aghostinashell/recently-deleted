import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeMetadata, sha256, signContext, verifyContext } from "../src/security.js";

test("hashing is stable", async () => {
  assert.equal(await sha256("invite"), await sha256("invite"));
});

test("signed invite context verifies and tampering fails", async () => {
  const token = await signContext({ inviteId: "one", expiresAt: Date.now() + 10000 }, "secret");
  assert.equal((await verifyContext(token, "secret")).inviteId, "one");
  assert.equal(await verifyContext(`${token}x`, "secret"), null);
});

test("sensitive metadata fields are removed", () => {
  assert.deepEqual(sanitizeMetadata({
    app_name: "messages",
    passcode: "1010",
    message_text: "private",
    nested: { password: "private", safe: "yes" }
  }), { app_name: "messages", nested: { safe: "yes" } });
});
