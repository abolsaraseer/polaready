// The client's design journey (polaready.com/design/#<token>).
//
// The token in the link is the only key, and it opens one event's design and
// nothing else. The client can read and save their own draft, upload a logo
// or a paper design, and submit. They can never touch the booth: the owner
// approves the draft in the dashboard before it becomes the system file.
//
// POST {token, action}
//   get     -> event name/date + the draft + links to their uploaded files
//   save    -> {design} replaces the draft (while not yet approved)
//   upload  -> {kind: "logo"|"paper"|"background", ext: "png"|"jpg"} -> signed upload URL
//   submit  -> marks the draft as sent to PolaReady
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
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

const HEX = /^#[0-9a-fA-F]{6}$/;
const FONTS = ["fugaz", "didot", "baskerville", "snell", "futura", "noteworthy", "bodoni", "avenir", "georgia", "optima", "typewriter", "nunito", "cairo"];
const str = (v: unknown, n: number) => (typeof v === "string" ? v.slice(0, n) : "");
const hex = (v: unknown, d: string) => (typeof v === "string" && HEX.test(v) ? v.toUpperCase() : d);
const file = (v: unknown) => (typeof v === "string" && /^client-[a-z]+-\d+\.(png|jpe?g)$/.test(v) ? v : null);

/** Keep only what the journey knows about, with sane limits. */
function clean(d: any) {
  const b = d?.booth ?? {}, p = d?.paper ?? {}, x = d?.details ?? {};
  const windows = Array.isArray(p.windows)
    ? p.windows.slice(0, 8).filter((w: any) => Array.isArray(w) && w.length === 4 && w.every((n: any) => typeof n === "number" && n >= 0 && n <= 1))
    : [];
  return {
    step: Math.max(0, Math.min(20, Number(d?.step) || 0)),
    booth: {
      mode: b.mode === "custom" ? "custom" : "default",
      logo: file(b.logo), background: file(b.background),
      bg: hex(b.bg, "#F5EFEB"), text: hex(b.text, "#233345"), accent: hex(b.accent, "#3F7A9C"),
      font: FONTS.includes(b.font) ? b.font : "fugaz",
      welcome_title: str(b.welcome_title, 60), welcome_sub: str(b.welcome_sub, 60),
    },
    details: { names: str(x.names, 40), date: str(x.date, 10), date_text: str(x.date_text, 24), message: str(x.message, 60) },
    paper: {
      mode: p.mode === "template" ? "template" : "color",
      bg: hex(p.bg, "#F5EFEB"), ink: hex(p.ink, "#233345"),
      photo_count: [3, 4, 5].includes(Number(p.photo_count)) ? Number(p.photo_count) : 4,
      template: file(p.template), windows,
    },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  let body: Record<string, any> = {};
  try { body = await req.json(); } catch { return json({ error: "Bad request" }, 400); }
  const token = String(body.token ?? "");
  if (!/^[A-Za-z0-9]{24,64}$/.test(token)) return json({ error: "not_found" }, 404);
  const { data: ev } = await db.from("events")
    .select("id,name,starts_at,venue,client_name,design,design_status").eq("design_token", token).maybeSingle();
  if (!ev) return json({ error: "not_found" }, 404);
  const locked = ev.design_status === "approved";

  switch (body.action) {
    case "get": {
      const d = ev.design ?? {};
      const names = [d?.booth?.logo, d?.booth?.background, d?.paper?.template].filter(Boolean) as string[];
      const files: Record<string, string> = {};
      for (const n of names) {
        const { data } = await db.storage.from("event-files").createSignedUrl(`${ev.id}/${n}`, 3600);
        if (data) files[n] = data.signedUrl;
      }
      return json({ event: { name: ev.name, starts_at: ev.starts_at, venue: ev.venue, client_name: ev.client_name }, design: d, status: ev.design_status, files });
    }
    case "save": {
      if (locked) return json({ error: "approved" }, 409);
      const d = clean(body.design);
      if (JSON.stringify(d).length > 20000) return json({ error: "Too big" }, 413);
      await db.from("events").update({
        design: d, design_updated_at: new Date().toISOString(),
        design_status: ev.design_status === "submitted" ? "submitted" : "in_progress",
      }).eq("id", ev.id);
      return json({ ok: true });
    }
    case "upload": {
      if (locked) return json({ error: "approved" }, 409);
      const kind = ["logo", "paper", "background"].includes(body.kind) ? body.kind : null;
      const ext = body.ext === "png" ? "png" : body.ext === "jpg" ? "jpg" : null;
      if (!kind || !ext) return json({ error: "Bad file" }, 400);
      const name = `client-${kind}-${Date.now()}.${ext}`;
      const { data, error } = await db.storage.from("event-files").createSignedUploadUrl(`${ev.id}/${name}`);
      if (error) return json({ error: error.message }, 500);
      return json({ name, url: data.signedUrl });
    }
    case "submit": {
      if (locked) return json({ error: "approved" }, 409);
      await db.from("events").update({ design_status: "submitted", design_updated_at: new Date().toISOString() }).eq("id", ev.id);
      return json({ ok: true });
    }
  }
  return json({ error: "Unknown action" }, 400);
});
