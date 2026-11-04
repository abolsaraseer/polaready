// The booth iPad's only door into the cloud.
//
// The iPad sends its booth key in `x-booth-key`. Only the key's SHA-256 is
// stored, so a leaked database never leaks a working key. Every action is
// scoped to the event the dashboard sent to this booth.
//
// Actions (POST JSON {action, ...}):
//   config   -> the active event's system file + short-lived links to its files
//   visit    -> register a guest visit; returns signed upload URLs for its photos
//   uploaded -> confirm which files landed, so the counters and gallery see them
//   log      -> print results and problems from the booth's event log
import { createClient } from "jsr:@supabase/supabase-js@2";

const db = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-booth-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

async function sha256(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const CODE = /^[A-Z2-9]{10}$/;
const UUID = /^[0-9a-f-]{36}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  // Typed on an iPad, so forgive dashes, spaces and lower case.
  const key = (req.headers.get("x-booth-key") ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (key.length < 20) return json({ error: "Missing booth key" }, 401);
  const { data: booth } = await db.from("booths").select("*").eq("token_hash", await sha256(key)).maybeSingle();
  if (!booth) return json({ error: "Unknown booth key" }, 401);

  let body: Record<string, any>;
  try { body = await req.json(); } catch { return json({ error: "Bad JSON" }, 400); }

  await db.from("booths").update({
    last_seen: new Date().toISOString(),
    app_version: typeof body.app === "string" ? body.app.slice(0, 40) : booth.app_version,
  }).eq("id", booth.id);

  const eventId: string | null = booth.active_event_id;

  switch (body.action) {
    case "config": {
      if (!eventId) return json({ booth: booth.name, event: null });
      const { data: ev } = await db.from("events")
        .select("id,name,starts_at,status,config,config_version").eq("id", eventId).single();
      if (!ev) return json({ booth: booth.name, event: null });
      // Files the dashboard attached (paper overlay, logo...). Links last an hour:
      // the iPad downloads them straight away and keeps its own copy.
      const files: { name: string; url: string }[] = [];
      const { data: list } = await db.storage.from("event-files").list(ev.id);
      for (const f of list ?? []) {
        const { data: s } = await db.storage.from("event-files").createSignedUrl(`${ev.id}/${f.name}`, 3600);
        if (s) files.push({ name: f.name, url: s.signedUrl });
      }
      return json({ booth: booth.name, event: ev, files });
    }

    case "visit": {
      if (!eventId) return json({ error: "No event is assigned to this booth" }, 409);
      const v = body.visit ?? {};
      if (!UUID.test(v.id ?? "") || !CODE.test(v.code ?? "")) return json({ error: "Bad visit" }, 400);
      const count = Math.max(0, Math.min(10, Number(v.photo_count) || 0));
      // A visit keeps the event it was first registered under, even if the
      // booth is moved to another event before its upload retries.
      const { data: existing } = await db.from("visits").select("event_id,secs,layout,paper,filter").eq("id", v.id).maybeSingle();
      const ev = existing?.event_id ?? eventId;
      const { error } = await db.from("visits").upsert({
        id: v.id, event_id: ev, booth_id: booth.id, code: v.code,
        started_at: v.started_at ?? new Date().toISOString(),
        // A retry may carry less than the first call did; never erase what we know.
        photo_count: count, secs: v.secs ?? existing?.secs ?? null,
        layout: v.layout ?? existing?.layout ?? null, paper: v.paper ?? existing?.paper ?? null,
        filter: v.filter ?? existing?.filter ?? null,
      });
      if (error) return json({ error: error.message }, 500);
      const names = [...Array(count).keys()].map((i) => `photo_${i}.jpg`);
      if (v.strip) names.push("strip.jpg");
      const uploads = [];
      for (const name of names) {
        const path = `${ev}/${v.id}/${name}`;
        const { data, error: e } = await db.storage.from("photos").createSignedUploadUrl(path, { upsert: true });
        if (e) return json({ error: e.message }, 500);
        uploads.push({ name, path, url: data.signedUrl });
      }
      return json({ event_id: ev, uploads });
    }

    case "uploaded": {
      const id = body.visit_id;
      if (!UUID.test(id ?? "")) return json({ error: "Bad visit" }, 400);
      const { data: visit } = await db.from("visits").select("id,event_id").eq("id", id).maybeSingle();
      if (!visit) return json({ error: "Unknown visit" }, 404);
      const rows = (body.files ?? []).filter((f: any) => /^(photo_\d+|strip)\.jpg$/.test(f.name)).map((f: any) => ({
        visit_id: id, event_id: visit.event_id,
        kind: f.name === "strip.jpg" ? "strip" : "photo",
        idx: f.name === "strip.jpg" ? 0 : Number(f.name.match(/\d+/)![0]),
        path: `${visit.event_id}/${id}/${f.name}`, bytes: f.bytes ?? null,
      }));
      if (rows.length) await db.from("photos").upsert(rows, { onConflict: "path" });
      const { data: all } = await db.from("photos").select("kind").eq("visit_id", id);
      await db.from("visits").update({
        photos_uploaded: (all ?? []).filter((p) => p.kind === "photo").length,
        has_strip: (all ?? []).some((p) => p.kind === "strip"),
      }).eq("id", id);
      return json({ ok: true });
    }

    case "log": {
      if (!eventId) return json({ ok: true, skipped: true });
      const prints = [], problems = [];
      for (const e of (body.events ?? []).slice(0, 200)) {
        if (!UUID.test(e.id ?? "")) continue;
        if (e.kind === "print") {
          prints.push({ id: e.id, event_id: eventId, visit_id: UUID.test(e.session ?? "") ? e.session : null,
            at: e.t, copies: Number(e.copies) || 1, ok: e.ok ?? null, mode: e.mode ?? null });
        } else if (e.kind === "captureFail" || e.kind === "problem") {
          problems.push({ id: e.id, event_id: eventId, visit_id: UUID.test(e.session ?? "") ? e.session : null,
            at: e.t, kind: e.kind, detail: e.detail ?? null });
        }
      }
      if (prints.length) await db.from("prints").upsert(prints, { onConflict: "id", ignoreDuplicates: true });
      if (problems.length) await db.from("problems").upsert(problems, { onConflict: "id", ignoreDuplicates: true });
      return json({ ok: true });
    }
  }
  return json({ error: "Unknown action" }, 400);
});
