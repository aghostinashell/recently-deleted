import { createHash, randomBytes, randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";

function argument(name, fallback) {
  const prefix = `--${name}=`;
  const value = process.argv.slice(2).find((item) => item.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
}

function sqlEscape(value) {
  return String(value).replaceAll("'", "''");
}

const displayName = argument("display-name", "DJ Analytics Test");
const accessType = argument("access-type", "DJ");
const accessLevel = argument("access-level", "All Access Test");
const siteUrl = argument("site-url", "https://ghostsinshells.com/");
const outputJson = argument("output-json", "");
const personalizedArtworkPath = argument("personalized-artwork-path", "");
const isTestArgument = argument("is-test", "true");
if (!["DJ", "public", "media", "venue", "owner"].includes(accessType)) {
  throw new Error("Unsupported access type.");
}
if (!["true", "false"].includes(isTestArgument)) {
  throw new Error("--is-test must be true or false.");
}
const isTest = isTestArgument === "true";
const token = randomBytes(32).toString("base64url");
const tokenHash = createHash("sha256").update(token).digest("hex");
const recipientId = `${isTest ? "test-" : ""}recipient-${randomUUID()}`;
const inviteId = `${isTest ? "test-" : ""}invite-${randomUUID()}`;
const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
const statements = [
  `INSERT INTO invite_recipients (id, display_name, access_level, personalized_artwork_path, is_test) VALUES ('${recipientId}', '${sqlEscape(displayName)}', '${sqlEscape(accessLevel)}', ${personalizedArtworkPath ? `'${sqlEscape(personalizedArtworkPath)}'` : "NULL"}, ${isTest ? 1 : 0});`,
  `INSERT INTO access_invites (id, recipient_id, token_hash, access_type, expires_at, is_test) VALUES ('${inviteId}', '${recipientId}', '${tokenHash}', '${sqlEscape(accessType)}', '${expiresAt}', ${isTest ? 1 : 0});`
].join("\n");

console.log("Run this SQL against the intended local or production D1 database:");
console.log(statements);
console.log("\nTest invite (shown once; store it securely):");
const inviteUrl = new URL(siteUrl);
inviteUrl.searchParams.set("invite", token);
if (outputJson) {
  writeFileSync(outputJson, JSON.stringify({
    sql: statements,
    inviteUrl: inviteUrl.href,
    inviteId,
    recipientId,
    expiresAt,
    isTest,
    personalizedArtworkPath: personalizedArtworkPath || null
  }), { mode: 0o600 });
  console.log(`Test invite written securely to ${outputJson}`);
  process.exit(0);
}
console.log(inviteUrl.href);
console.log(`\nTest invite ID: ${inviteId}`);
