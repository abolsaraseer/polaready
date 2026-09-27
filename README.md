# PolaReady — brand story & brand kit

The origin story of **PolaReady**, an instant photobooth brand, and its brand kit.
Live at <https://abolsaraseer.github.io/polaready/>.

## Pages

| Path | Page | What it is |
| --- | --- | --- |
| `/` | The story | A scroll-driven telling of the brand: the science, the myth, the mark, the booth. EN / عربي toggle. |
| `/brand-kit/` | The brand kit | Palette (with measured contrast), type, the bear mark, applications, and a click-to-copy caption library. |

## How it's built

Plain HTML, CSS and JavaScript — no build step, no dependencies. The only external
resource is Google Fonts (Fugaz One, Nunito Sans, IBM Plex Mono, Cairo).

```
index.html            the story
brand-kit/index.html  the kit
css/site.css          every style, shared by both pages (brand tokens at the top)
js/site.js            one small scroll engine + language switch + booth preview
js/i18n.js            Arabic for every string (English lives in the HTML)
assets/               the bear mark (used as a CSS mask), icons, social card
```

Every animation is driven by a single 0-1 progress value per section, which the CSS
reads. Everything respects `prefers-reduced-motion`: the pinned sequences become plain
stacked sections and nothing moves.

## Editing

- **Colours / type** — the tokens at the top of `css/site.css`.
- **Copy** — English is written directly in the HTML; the Arabic for the same
  `data-i18n` key is in `js/i18n.js`. Add both when you add a line.
- **The mark** — `assets/mark.png` is an alpha mask, so `.mark` can be any colour via
  `color:`. Replace the file to change it everywhere.
- **Cache-busting** — bump the `?v=` on the CSS/JS links after a change so returning
  visitors get the new files.

## Local preview

```
python3 -m http.server 8000
```

Then open <http://localhost:8000>. Add `?nointro` to skip the 3-2-1 opening, or
`?lang=ar` to open in Arabic.
