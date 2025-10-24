// APS SimpleTexting Router - Railway deployment
// Routes by EXISTING LIST membership. No ZIP inference. Fallback = North.
// Includes keyword used + current date/time (America/Chicago) in the forwarded message.

const express = require("express");
const app = express();

// Parse JSON + form bodies (needed for SimpleTexting v2 POST)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ---- ENV ----
const ST_TOKEN = process.env.ST_TOKEN;                 // SimpleTexting API token
const MARKETING_NUMBER = process.env.MARKETING_NUMBER; // Your SimpleTexting main number (digits only)

// Map your EXISTING SimpleTexting LIST NAMES -> destination service numbers
const LIST_TO_NUMBER = {
  "502-356-0918": process.env.NORTH_NUMBER,   // North list name -> North service number
  "865-591-2993": process.env.SOUTH_NUMBER,   // South list name -> South service number
  "803-719-0784": process.env.EAST_NUMBER,    // East  list name -> East  service number
  "904-728-4226": process.env.WEST_NUMBER,    // West  list name -> West  service number
  "864-354-3098": process.env.CENTRAL_NUMBER  // Central list name -> Central service number
};

// Fallback area (you chose North)
const FALLBACK_NUMBER = process.env.NORTH_NUMBER;

// --- Helpers ---
async function sendSMS(phone, message) {
  const url = new URL("https://app2.simpletexting.com/v1/send");
  url.searchParams.set("token", ST_TOKEN);
  url.searchParams.set("phone", phone);
  url.searchParams.set("message", message);

  async function main() {
  // your existing startup code
}
main();

  const resp = await fetch(url, { method: "POST", headers: { accept: "application/json" } });
  let data = {};
  try { data = await resp.json(); } catch {}
  if (!resp.ok || data?.code !== 1) {
    console.error("Failed to send", resp.status, data);
  }
  return data;
}

async function listMembers(listName) {
  const url = new URL("https://app2.simpletexting.com/v1/group/contact/list");
  url.searchParams.set("token", ST_TOKEN);
  url.searchParams.set("group", listName);

  const resp = await fetch(url, { headers: { accept: "application/json" } });
  let data = await resp.json().catch(() => ({}));
  const arr = Array.isArray(data) ? data : (data.contacts || []);
  return arr;
}

async function isMemberOfList(listName, phone) {
  const members = await listMembers(listName);
  const norm = (s) => (s || "").replace(/\D/g, "");
  const target = norm(phone);
  return members.some((c) => norm(c.phone) === target);
}

// Format a Central Time timestamp
function ctStamp() {
  try {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "America/Chicago",
    }).format(new Date());
  } catch {
    return new Date().toISOString();
  }
}

// Extract the first token as the "keyword used" (uppercased, safe length)
function extractKeyword(text) {
  const k = (text || "").trim().split(/\s+/)[0] || "";
  return k.toUpperCase().slice(0, 32);
}

// --- Webhook route ---
// Handles BOTH GET and POST payloads from SimpleTexting
app.post("/receivesms", async (req, res) => {
  try {
    const body = req.body || {};
    console.log("Incoming webhook:", JSON.stringify(body, null, 2));

    const v = body.values || {};
    const from = v.contactPhone || body.contactPhone || body.from || body.phone;
    const text = v.text || body.text || v.message || body.message || "";

    if (!from || !text) {
      console.log("Ignored event (missing from/text):", body);
      return res.status(200).send("IGNORED");
    }

    console.log(`📩 Message received from ${from}: ${text}`);

    if (text.trim().toLowerCase().includes("north")) {
      console.log("Triggering autoresponder for keyword:", text);
      // Place your autoresponder send logic here
    }

    res.status(200).send("OK");
  } catch (err) {
    console.error("Error in /receivesms:", err);
    res.status(200).send("IGNORED");
  }
});


    // Determine list membership
    const listNames = Object.keys(LIST_TO_NUMBER);
async function start() {

    const checks = await Promise.all(
      listNames.map(async (name) => ({ name, ok: await isMemberOfList(name, from) }))
    );
    const hit = checks.find((c) => c.ok);
    const matchedList = hit?.name || null;

    // Destination number
    const forwardTo = (matchedList && LIST_TO_NUMBER[matchedList]) || FALLBACK_NUMBER;

    // Area label
    const areaLabel =
      matchedList === "502-356-0918" ? "North"  :
      matchedList === "865-591-2993" ? "South"  :
      matchedList === "803-719-0784" ? "East"   :
      matchedList === "904-728-4226" ? "West"   :
      matchedList === "864-354-3098" ? "Central" : "North (Fallback)";

    // Build outbound message
    const stamp = ctStamp();
    const keyword = extractKeyword(text);
    const truncatedMsg = text.slice(0, 160);
    const outbound =
      `APS Lead (${areaLabel}) — ${stamp} CT\n` +
      `From: ${from}\n` +
      (keyword ? `Keyword: ${keyword}\n` : "") +
      `Msg: ${truncatedMsg}`;

    await sendSMS(forwardTo, outbound);

    // Always 200 so SimpleTexting doesn't retry/remove webhook
    return res.status(200).send("OK");
  } catch (e) {
    console.error("receivesms error:", e);
    return res.status(200).send("OK"); // still 200 to prevent webhook deletion
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`APS ST Router running on :${PORT}`));
}

start();
