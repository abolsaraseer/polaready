// The client's page (polaready.com/design/#<token>).
//
// The token in the link is the only key, and it opens one event's design and
// nothing else. Every save is turned into the event's system file straight
// away, so the booth picks it up on its next welcome screen. The client's
// "I approve" locks the design; only the owner can unlock it.
//
// POST {token, action}
//   get     -> event name/date + the design + links to their uploaded files
//   save    -> {design} replaces the design and updates the booth (unless locked)
//   upload  -> {kind: "logo"|"paper"|"background", ext: "png"|"jpg"} -> signed upload URL
//   approve -> the client locks their design
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

// ---- the design -> the booth's system file ----
// Same rules as compile()/themeFrom() in design/common.js: keep them in step.
const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const toHex = (a: number[]) => "#" + a.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("").toUpperCase();
const mix = (a: string, b: string, t: number) => toHex(rgb(a).map((v, i) => v + (rgb(b)[i] - v) * t));
const lum = (h: string) => { const c = rgb(h).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const contrast = (a: string, b: string) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const BODY_OF: Record<string, string> = { fugaz: "nunito" };

function themeFrom(b: any) {
  const bg = b.bg, text = b.text, accent = b.accent;
  const dark = lum(bg) < 0.4;
  const onAccent = [bg, "#FFFFFF", "#111111"].sort((x, y) => contrast(y, accent) - contrast(x, accent))[0];
  return {
    bg, bg2: bg, card: dark ? mix(bg, "#FFFFFF", 0.08) : mix(bg, "#FFFFFF", 0.7),
    text, muted: mix(text, bg, 0.35), line: mix(text, bg, 0.8), accent, on_accent: onAccent,
    font_display: b.font, font_body: BODY_OF[b.font] ?? "avenir",
    welcome_title: b.welcome_title || "", welcome_sub: b.welcome_sub || "",
    welcome_bg: b.background || null, logo: b.logo || null,
  };
}

function compile(d: ReturnType<typeof clean>, base: any) {
  const b = d.booth, p = d.paper, x = d.details;
  const c: any = { ...(base ?? {}) };
  c.title = x.names || c.title || "";
  c.date_text = x.date_text || c.date_text || "";
  c.message = x.message ?? c.message ?? "";
  c.theme = b.mode === "custom" ? themeFrom(b) : null;
  if (p.mode === "template" && p.template && p.windows.length >= 2) {
    c.paper_template = p.template; c.paper_windows = p.windows;
    c.photo_count = p.windows.length; c.lock_count = true;
  } else {
    c.paper_template = null; c.paper_windows = null;
    c.paper = { bg: p.bg, ink: p.ink };
    c.photo_count = p.photo_count; c.lock_count = true; c.lock_paper = true;
  }
  c.overlay = null;
  return c;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  let body: Record<string, any> = {};
  try { body = await req.json(); } catch { return json({ error: "Bad request" }, 400); }
  const token = String(body.token ?? "");
  if (!/^[A-Za-z0-9]{24,64}$/.test(token)) return json({ error: "not_found" }, 404);
  const { data: ev } = await db.from("events")
    .select("id,name,starts_at,venue,client_name,status,design,design_status,config,config_version")
    .eq("design_token", token).maybeSingle();
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
      const { count } = await db.from("booths").select("id", { count: "exact", head: true }).eq("active_event_id", ev.id);
      return json({
        event: { name: ev.name, starts_at: ev.starts_at, venue: ev.venue, client_name: ev.client_name },
        design: d, status: ev.design_status, files, booth: (count ?? 0) > 0,
      });
    }
    case "save": {
      if (locked) return json({ error: "approved" }, 409);
      const d = clean(body.design);
      if (JSON.stringify(d).length > 20000) return json({ error: "Too big" }, 413);
      const config = compile(d, ev.config);
      const changed = JSON.stringify(config) !== JSON.stringify(ev.config);
      const { error } = await db.from("events").update({
        design: d, design_updated_at: new Date().toISOString(), design_status: "in_progress",
        ...(changed ? { config, config_version: ev.config_version + 1 } : {}),
      }).eq("id", ev.id);
      if (error) return json({ error: error.message }, 500);
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
    case "approve": {
      if (locked) return json({ ok: true });
      await db.from("events").update({
        design_status: "approved", design_updated_at: new Date().toISOString(),
        ...(ev.status === "design" ? { status: "ready" } : {}),
      }).eq("id", ev.id);
      return json({ ok: true });
    }
  }
  return json({ error: "Unknown action" }, 400);
});
