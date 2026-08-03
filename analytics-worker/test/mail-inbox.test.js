import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const mailSourcePath = new URL("../../js/mail.js", import.meta.url);
const campaignsPath = new URL("../../data/mail/ads.json", import.meta.url);

async function deduplicator() {
  const source = await readFile(mailSourcePath, "utf8");
  const start = source.indexOf("function deduplicateInboxDeliveries");
  const end = source.indexOf("\n\n  function persistInboxDeliveries", start);
  assert.ok(start >= 0 && end > start, "mail deduplication policy must exist");
  return Function(`${source.slice(start, end)}; return deduplicateInboxDeliveries;`)();
}

test("ordinary sponsor mail keeps only its newest delivery", async () => {
  const deduplicate = await deduplicator();
  const campaigns = [
    { id: "blank-tab-studios", tier: "Premium", premiumSponsor: false },
    { id: "inkworks", tier: "Standard" }
  ];
  const deliveries = [
    { id: "blank-old", campaignId: "blank-tab-studios" },
    { id: "ink-old", campaignId: "inkworks" },
    { id: "blank-new", campaignId: "blank-tab-studios" },
    { id: "ink-new", campaignId: "inkworks" }
  ];
  assert.deepEqual(deduplicate(deliveries, campaigns).map((item) => item.id), ["blank-new", "ink-new"]);
});

test("explicit premium sponsors and order mail may retain repeated deliveries", async () => {
  const deduplicate = await deduplicator();
  const campaigns = [{ id: "house", tier: "Premium", premiumSponsor: true }];
  const deliveries = [
    { id: "house-one", campaignId: "house" },
    { id: "order-confirmation", type: "order", orderId: "1", stage: "confirmation" },
    { id: "house-two", campaignId: "house" },
    { id: "order-shipping", type: "order", orderId: "1", stage: "shipping" }
  ];
  assert.deepEqual(deduplicate(deliveries, campaigns).map((item) => item.id),
    ["house-one", "order-confirmation", "house-two", "order-shipping"]);
});

test("Blank Tab is explicitly single-instance despite its campaign tier", async () => {
  const data = JSON.parse(await readFile(campaignsPath, "utf8"));
  const blankTab = data.campaigns.find((campaign) => campaign.id === "blank-tab-studios");
  assert.equal(blankTab.tier, "Premium");
  assert.equal(blankTab.premiumSponsor, false);
});
