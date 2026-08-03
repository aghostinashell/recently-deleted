import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const enginePath = new URL("../../data/messages/amber-response-engine.json", import.meta.url);
const messagesPath = new URL("../../js/messages.js", import.meta.url);

async function engine() {
  return JSON.parse(await readFile(enginePath, "utf8"));
}

test("Amber's locked response library is extensive and data-driven", async () => {
  const data = await engine();
  assert.equal(data.version, "1.0-locked");
  assert.equal(data.categories.length, 20);
  assert.ok(data.categories.every((category) => category.responses.length >= 5));
  assert.ok(data.categories.reduce((total, category) => total + category.responses.length, 0) >= 190);
  assert.ok(data.fallbackResponses.length >= 10);
});

test("Amber preserves the existing trigger delays", async () => {
  const data = await engine();
  const category = (id) => data.categories.find((item) => item.id === id);
  assert.equal(category("home").delaySeconds, 10);
  assert.equal(category("wyd").delaySeconds, 14);
  assert.equal(category("late-night").delaySeconds, 3);
  assert.equal(category("come-over").delaySeconds, 4);
  assert.equal(category("missing-someone").delaySeconds, 15);
  assert.equal(category("voice-messages").delaySeconds, 3);
  assert.equal(category("good-morning").delaySeconds, 64);
  assert.equal(category("tension").triggerDelays["my bad"], 25);
  assert.equal(category("tension").triggerDelays["you mad"], 60);
});

test("Amber's activity and continuity rules are represented in the client engine", async () => {
  const data = await engine();
  const driving = data.categories.find((item) => item.id === "driving");
  assert.deepEqual(driving.activity, { minMinutes: 5, maxMinutes: 8 });
  for (const id of ["work", "shopping", "food", "watching-tv", "gym", "sleep", "travel"]) {
    assert.ok(data.categories.find((item) => item.id === id)?.activity, `${id} must persist`);
  }
  const source = await readFile(messagesPath, "utf8");
  assert.match(source, /response-state/);
  assert.match(source, /activeAmberCategory/);
  assert.match(source, /recentResponses/);
  assert.match(source, /reply\.split\(\/\\n\{2,\}\/\)/);
});

test("Amber prioritizes conversation context and browser-local user memory", async () => {
  const source = await readFile(messagesPath, "utf8");
  assert.match(source, /function rememberAmberContext/);
  assert.match(source, /function recalledAmberReply/);
  assert.match(source, /recentUserMessages/);
  assert.match(source, /\.slice\(-12\)/);
  assert.match(source, /facts\.lastFeeling/);
  assert.match(source, /facts\.lastUserActivity/);
  assert.match(source, /sharedContext\.kind \|\| memoryQuestion \? null/);
  assert.match(source, /writeList\(pendingKey\(thread\.threadId\), \[\]\)/);
});

test("Amber does not let time of day override the user's actual topic", async () => {
  const source = await readFile(messagesPath, "utf8");
  const matcher = source.slice(
    source.indexOf("function matchingAmberCategory"),
    source.indexOf("function chooseAmberResponse")
  );
  assert.doesNotMatch(matcher, /getHours/);
  assert.doesNotMatch(matcher, /getDay/);
  assert.match(matcher, /lastTopicAt/);
  assert.match(matcher, /messageMatchesTrigger/);
});
