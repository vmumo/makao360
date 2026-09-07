#!/usr/bin/env node
/**
 * Smoke test: /mobile-preview tabs render and KES formatting is present.
 * Assumes the dev server is running on http://localhost:8080.
 */
import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "http://localhost:8080";
const TABS = ["home", "pay", "passport", "me"];

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } });
const page = await ctx.newPage();

const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});

for (const tab of TABS) {
  await page.goto(`${BASE}/mobile-preview?tab=${tab}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(150);
}

// Basic sanity: KES prefix should appear on Pay tab
await page.goto(`${BASE}/mobile-preview?tab=pay`, { waitUntil: "networkidle" });
const body = (await page.content()).toLowerCase();
if (!body.includes("kes")) errors.push("KES formatting not found in Pay tab");

await browser.close();

if (errors.length) {
  console.error("Mobile preview smoke check FAILED:\n" + errors.join("\n"));
  process.exit(1);
}
console.log("Mobile preview smoke check: OK");
