// The guest's QR page asks here for one visit's photos.
//
// The 10-character code printed on the paper is the only key. It opens that
// one visit and nothing else: there is no listing, and links expire after an
// hour, so a forwarded link stops working on its own.
//
// POST {code}                      -> event title + colours + photo links
// POST {code, action:"download"}   -> counts a download for the dashboard
import { createClient } from "jsr:@supabase/supabase-js@2";

const db = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  let body: Record<string, any> = {};
  try { body = await req.json(); } catch { /* empty */ }
  const code = String(body.code ?? "").toUpperCase();
  if (!/^[A-Z2-9]{10}$/.test(code)) return json({ error: "not_found" }, 404);

  const { data: visit } = await db.from("visits")
    .select("id,event_id,started_at,photo_count,photos_uploaded,has_strip").eq("code", code).maybeSingle();
  if (!visit) return json({ state: "pending" }); // printed, not uploaded yet

  if (body.action === "download") {
    await db.from("scans").insert({ event_id: visit.event_id, visit_id: visit.id, kind: "download" });
    return json({ ok: true });
  }

  const { data: ev } = await db.from("events").select("name,config").eq("id", visit.event_id).single();
  const cfg = (ev?.config ?? {}) as Record<string, any>;
  if (cfg.qr === false) return json({ error: "not_found" }, 404);
  await db.from("scans").insert({ event_id: visit.event_id, visit_id: visit.id, kind: "open" });

  const { data: rows } = await db.from("photos").select("kind,idx,path").eq("visit_id", visit.id).order("kind").order("idx");
  const items = [];
  for (const r of rows ?? []) {
    const { data: s } = await db.storage.from("photos").createSignedUrl(r.path, 3600);
    const { data: d } = await db.storage.from("photos").createSignedUrl(r.path, 3600, {
      download: `PolaReady-${code}-${r.kind === "strip" ? "paper" : `photo-${r.idx + 1}`}.jpg`,
    });
    if (s && d) items.push({ kind: r.kind, idx: r.idx, url: s.signedUrl, download: d.signedUrl });
  }
  return json({
    state: items.length >= visit.photo_count ? "ready" : "partial",
    title: cfg.title || ev?.name || "PolaReady",
    message: cfg.message ?? "",
    date: visit.started_at,
    paper: cfg.paper ?? null,
    expected: visit.photo_count + 1,
    items,
  });
});
