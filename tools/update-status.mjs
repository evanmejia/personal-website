#!/usr/bin/env node
/**
 * update-status.mjs — rewrite status.json from cal.com bookings.
 *
 * Counts Evan's active bookings in the next 30 days and writes the
 * matching status pill state to status.json (rendered in the
 * index.html sidebar).
 *
 * Rules: 0 bookings = green, 1-2 = yellow, 3+ = red.
 *
 * Uses the cal.com API v2 (v1 was retired April 2026):
 *   GET /v2/bookings?status=upcoming&afterStart=..&beforeEnd=..&limit=10
 *   headers: Authorization: Bearer <key>, cal-api-version: 2026-05-01
 *
 * Safety: on ANY failure the existing status.json is left untouched and
 * the exit code is non-zero, so cron logging catches it.
 *
 * Requires Node 18+ (global fetch). The API key comes from the
 * environment — never commit it to this repo.
 *
 * Usage:
 *   CALCOM_API_KEY=cal_... node tools/update-status.mjs [output-path]
 *
 * Cron (every 6 h, key in a 600-perm env file):
 *   0 0,6,12,18 * * * cd /var/www/evanmejia && set -a && . /etc/evanmejia.env && set +a && \
 *     node tools/update-status.mjs >> /var/log/evanmejia-status.log 2>&1
 */

import { writeFileSync, renameSync } from "node:fs";

const API_KEY = process.env.CALCOM_API_KEY;
if (!API_KEY) {
  console.error("CALCOM_API_KEY is not set");
  process.exit(1);
}

const DAY_MS = 86_400_000;
const WINDOW_DAYS = 30;
const now = new Date();
const url =
  "https://api.cal.com/v2/bookings" +
  "?status=upcoming" +
  "&afterStart=" + encodeURIComponent(now.toISOString()) +
  "&beforeEnd=" +
  encodeURIComponent(new Date(now.getTime() + WINDOW_DAYS * DAY_MS).toISOString()) +
  "&limit=10";

const LABELS = {
  green: "Available for contracts",
  yellow: "Limited availability",
  red: "Fully booked",
};

let res;
try {
  res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "cal-api-version": "2026-05-01",
    },
  });
} catch (err) {
  console.error(`network error: ${err.message}`);
  process.exit(1);
}

if (!res.ok) {
  const body = (await res.text()).slice(0, 300);
  console.error(`cal.com API error ${res.status}: ${body}`);
  process.exit(1);
}

const payload = await res.json();
const bookings = payload.data ?? [];
const hasMore = payload.pagination?.hasMore ?? false;

// limit=10: a full page (or hasMore) means 10+ bookings, which is
// already in the red band — so one request is always sufficient.
const count = hasMore ? 10 : bookings.length;
const status = count >= 3 ? "red" : count >= 1 ? "yellow" : "green";

const out = { status, label: LABELS[status], updated: new Date().toISOString() };
const target = process.argv[2] ?? "status.json";
const tmp = `${target}.tmp`;
writeFileSync(tmp, JSON.stringify(out) + "\n", "utf8");
renameSync(tmp, target); // atomic on POSIX: readers never see a partial file
console.log(
  `${new Date().toISOString()} count=${count} status=${status} -> ${target}`,
);
