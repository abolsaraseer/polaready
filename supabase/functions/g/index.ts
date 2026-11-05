// What a guest's phone opens when it scans the QR code on a printed paper:
// GET /functions/v1/g/<CODE>
//
// No page at all: the phone is sent straight to the paper image as a download
// (Android saves it at once; iPhone asks "Download?" once and keeps it in
// Files > Downloads). If the paper hasn't finished uploading, a small "on its
// way" image says to scan again shortly.
import { createClient } from "jsr:@supabase/supabase-js@2";

const db = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

const card = (title: string, line: string) => new Response(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 900" width="600" height="900">
  <rect width="600" height="900" fill="#F5EFEB"/>
  <circle cx="300" cy="330" r="74" fill="#233345"/>
  <circle cx="246" cy="270" r="26" fill="#233345"/><circle cx="354" cy="270" r="26" fill="#233345"/>
  <circle cx="276" cy="322" r="9" fill="#F5EFEB"/><circle cx="324" cy="322" r="9" fill="#F5EFEB"/>
  <ellipse cx="300" cy="356" rx="20" ry="14" fill="#F5EFEB"/><circle cx="300" cy="350" r="6" fill="#233345"/>
  <text x="300" y="500" text-anchor="middle" font-family="-apple-system,Helvetica,Arial,sans-serif" font-size="40" font-weight="800" fill="#233345">${title}</text>
  <text x="300" y="556" text-anchor="middle" font-family="-apple-system,Helvetica,Arial,sans-serif" font-size="26" fill="#56606C">${line}</text>
  <text x="300" y="840" text-anchor="middle" font-family="-apple-system,Helvetica,Arial,sans-serif" font-size="24" font-weight="800" fill="#233345">PolaReady</text>
</svg>`,
  { status: 200, headers: { "Content-Type": "image/svg+xml", "Cache-Control": "no-store" } },
);

Deno.serve(async (req) => {
  const last = new URL(req.url).pathname.split("/").filter(Boolean).pop() ?? "";
  const code = last.toUpperCase();
  if (!/^[A-Z2-9]{10}$/.test(code)) return card("Hmm, that's not right", "Try scanning the paper again.");

  const { data: visit } = await db.from("visits").select("id,event_id").eq("code", code).maybeSingle();
  if (!visit) return card("On its way…", "Scan again in a minute.");

  const { data: ev } = await db.from("events").select("config").eq("id", visit.event_id).single();
  if ((ev?.config as Record<string, unknown> | null)?.qr === false) return card("Not available", "Ask the PolaReady team.");

  const { data: strip } = await db.from("photos").select("path").eq("visit_id", visit.id).eq("kind", "strip").maybeSingle();
  if (!strip) return card("On its way…", "Scan again in a minute.");

  // Counted as a scan and a download: scanning now starts the download.
  await db.from("scans").insert([
    { event_id: visit.event_id, visit_id: visit.id, kind: "open" },
    { event_id: visit.event_id, visit_id: visit.id, kind: "download" },
  ]);
  // `download` makes storage answer with Content-Disposition: attachment, so the
  // phone saves the file straight away instead of showing it.
  const { data: s } = await db.storage.from("photos").createSignedUrl(strip.path, 3600, {
    download: `PolaReady-${code}.jpg`,
  });
  if (!s) return card("On its way…", "Scan again in a minute.");
  return new Response(null, { status: 302, headers: { Location: s.signedUrl, "Cache-Control": "no-store" } });
});
