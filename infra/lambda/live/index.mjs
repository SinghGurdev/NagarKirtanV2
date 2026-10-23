// Live-tracking endpoint (Lambda function URL). The lead phone POSTs here;
// everyone else reads the result from the site at /live/state.json.
//
// Body: { passcode, action, ...fields }  (see compute.mjs for actions)
//   action "check" only verifies the passcode and returns the current state.

import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import { timingSafeEqual } from "node:crypto";
import { apply, emptyState, prepareRoute } from "./compute.mjs";

const BUCKET = process.env.BUCKET;
const SECRET_ARN = process.env.SECRET_ARN;
const STATE_KEY = "live/state.json";

const s3 = new S3Client({});
const secrets = new SecretsManagerClient({});

let passcode = { value: null, at: 0 };
let data = { route: null, content: null, at: 0 };

async function getPasscode() {
  if (passcode.value && Date.now() - passcode.at < 5 * 60 * 1000) return passcode.value;
  const r = await secrets.send(new GetSecretValueCommand({ SecretId: SECRET_ARN }));
  passcode = { value: r.SecretString.trim(), at: Date.now() };
  return passcode.value;
}

async function readJson(key) {
  try {
    const r = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
    return JSON.parse(await r.Body.transformToString());
  } catch (e) {
    if (e.name === "NoSuchKey" || e.$metadata?.httpStatusCode === 404) return null;
    throw e;
  }
}

async function getData() {
  // Route and schedule come from the deployed site, so edits to
  // content.json or route.json are picked up within a minute.
  if (data.route && Date.now() - data.at < 60 * 1000) return data;
  const [route, content] = await Promise.all([readJson("data/route.json"), readJson("data/content.json")]);
  data = { route: prepareRoute(route), content, at: Date.now() };
  return data;
}

function same(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

const reply = (status, body) => ({
  statusCode: status,
  headers: { "content-type": "application/json", "cache-control": "no-store" },
  body: JSON.stringify(body),
});

const finite = (v) => typeof v === "number" && Number.isFinite(v);

// What the lead phone needs back (the full state is public at /live/state.json).
const summary = (s) => ({
  status: s.status,
  phase: s.phase,
  street: s.street,
  nextTurn: s.nextTurn,
  turnSoon: s.turnSoon,
  offRoute: s.offRoute,
  progressMeters: s.progressMeters,
  legMeters: s.legMeters,
  updatedAt: s.updatedAt,
});

export async function handler(event) {
  if (event.requestContext?.http?.method !== "POST") return reply(405, { error: "use POST" });

  let body;
  try {
    const raw = event.isBase64Encoded ? Buffer.from(event.body || "", "base64").toString() : event.body || "";
    if (raw.length > 4096) return reply(413, { error: "too large" });
    body = JSON.parse(raw);
  } catch {
    return reply(400, { error: "bad json" });
  }

  if (!body.passcode || !same(body.passcode, await getPasscode())) {
    await new Promise((r) => setTimeout(r, 600)); // slow down guessing
    return reply(401, { error: "wrong-passcode" });
  }

  const prev = (await readJson(STATE_KEY)) ?? emptyState();
  if (body.action === "check") return reply(200, { ok: true, state: summary(prev) });

  if (body.action === "position") {
    const { lat, lng, accuracy, battery } = body;
    if (!finite(lat) || !finite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      return reply(400, { error: "bad position" });
    }
    body = {
      action: "position",
      lat,
      lng,
      accuracy: finite(accuracy) ? Math.round(accuracy) : null,
      battery: finite(battery) ? Math.round(battery) : null,
    };
  }

  let next;
  try {
    const { route, content } = await getData();
    next = apply(prev, body, { route, content, now: Date.now() });
  } catch (e) {
    return reply(400, { error: e.message });
  }

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: STATE_KEY,
      Body: JSON.stringify(next),
      ContentType: "application/json",
      CacheControl: "public, max-age=2",
    }),
  );
  return reply(200, { ok: true, state: summary(next) });
}
