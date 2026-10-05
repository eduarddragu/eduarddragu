// Builds the profile README's SVGs, a light and a dark version of each, in the
// palette and type of eduarddragu.dev.
//
// GitHub renders README images through <img>, which can't load external fonts,
// so each SVG embeds its fonts as data URIs. Google Fonts' `text=` parameter
// returns a subset with only the glyphs actually used, which keeps that to a
// few KB per face. Run `node scripts/build.mjs` after changing any copy.

import { mkdir, writeFile } from "node:fs/promises";

// From the site's globals.css. The grid is a touch stronger than the site's:
// on a 1000px card the 0.035 version disappears.
const PALETTES = {
  light: {
    bg: "#faf8f5", bgSubtle: "#f0ebe3", fg: "#1a1714", muted: "#5a4e42", faint: "#766859",
    accent: "#b04619", accentDim: "rgba(176,70,25,0.12)", accentContainer: "#f7e5dc",
    border: "#e2dbd2", borderStrong: "#c9bfb4", hairline: "#e2dbd2", grid: "rgba(176,70,25,0.07)",
    edge: "#e2dbd2",
  },
  dark: {
    bg: "#1a1714", bgSubtle: "#2a2420", fg: "#faf8f5", muted: "#b3a597", faint: "#9a8c7e",
    accent: "#e8743f", accentDim: "rgba(232,116,63,0.14)", accentContainer: "#422518",
    border: "#342c26", borderStrong: "#4a3f36", hairline: "#4a3f36", grid: "rgba(232,116,63,0.08)",
    // A card's outline on GitHub's own dark page, where the site's border melts into it.
    edge: "#4a3f36",
  },
};

const FONTS = {
  display: { family: "Cormorant Garamond", axes: "ital,wght@0,300", fallback: "Georgia, serif" },
  displayRegular: { family: "Cormorant Garamond", axes: "ital,wght@0,400", fallback: "Georgia, serif" },
  displayItalic: { family: "Cormorant Garamond", axes: "ital,wght@1,500", fallback: "Georgia, serif", style: "italic" },
  sans: { family: "DM Sans", axes: "wght@400", fallback: "system-ui, sans-serif" },
  sansMedium: { family: "DM Sans", axes: "wght@500", fallback: "system-ui, sans-serif" },
  mono: { family: "Geist Mono", axes: "wght@500", fallback: "ui-monospace, monospace" },
};

const EASE_ENTRANCE = "cubic-bezier(0.16, 1, 0.3, 1)";
const EASE_UI = "cubic-bezier(0.23, 1, 0.32, 1)";

const escape = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Records which glyphs each font needs while a template renders. */
function textRecorder() {
  const used = {};
  const t = (font, s) => {
    (used[font] ??= new Set());
    for (const ch of s) used[font].add(ch);
    return escape(s);
  };
  return { t, used };
}

const fontCache = new Map();
async function fontFace(key, chars) {
  const font = FONTS[key];
  const text = [...chars].sort().join("");
  const cacheKey = `${key}:${text}`;
  if (fontCache.has(cacheKey)) return fontCache.get(cacheKey);
  const url = `https://fonts.googleapis.com/css2?family=${font.family.replace(/ /g, "+")}:${font.axes}&text=${encodeURIComponent(text)}`;
  // A modern UA, or Google serves TTF instead of woff2.
  const ua = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
  const css = await (await fetch(url, { headers: { "User-Agent": ua } })).text();
  const src = css.match(/url\((https:[^)]+)\)/)?.[1];
  if (!src) throw new Error(`No font URL for ${key}: ${css.slice(0, 200)}`);
  const data = Buffer.from(await (await fetch(src)).arrayBuffer()).toString("base64");
  // Each face gets its own family name, so weights and styles never fall back onto each other.
  const face = `@font-face{font-family:'ed-${key}';src:url(data:font/woff2;base64,${data}) format('woff2');}`;
  fontCache.set(cacheKey, face);
  return face;
}

const ff = (key) => `font-family:'ed-${key}','${FONTS[key].family}',${FONTS[key].fallback};${FONTS[key].style ? `font-style:${FONTS[key].style};` : ""}`;

// ── Header: the landing page's hero, as a card ──────────────────────────────

function header(p, t) {
  const W = 1000, H = 360;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs>
  <pattern id="grid" width="72" height="72" x="32" y="0" patternUnits="userSpaceOnUse">
    <path d="M0 0V72M0 0H72" fill="none" stroke="${p.grid}" stroke-width="1"/>
  </pattern>
  <clipPath id="card"><rect width="${W}" height="${H}" rx="16"/></clipPath>
</defs>
<style>
  /*FONTS*/
  text { white-space: pre; }
  .name { ${ff("display")} font-size: 68px; letter-spacing: -0.025em; fill: ${p.fg}; }
  .name .em { ${ff("displayItalic")} font-weight: 500; fill: ${p.accent}; }
  .loc { ${ff("mono")} font-size: 12px; letter-spacing: 0.12em; fill: ${p.faint}; }
  .role { ${ff("mono")} font-size: 15.5px; letter-spacing: 0.108em; fill: ${p.accent}; }
  .tag { ${ff("display")} font-size: 25px; fill: ${p.fg}; }

  /* Media queries inside an SVG shown as an image see its rendered width, so on a phone
     (where the whole card is ~350px) the small lines grow and restack. They move via
     the wrapping group, since the entrance animation owns the text's own transform. */
  @media (max-width: 600px) {
    .loc { font-size: 26px; }
    .role { font-size: 30px; }
    .tag { font-size: 40px; }
    .m-loc { transform: translateY(16px); }
    .m-role { transform: translateY(40px); }
    .m-tag { transform: translateY(56px); }
    .divider { display: none; }
  }

  /* The site's opening, beat for beat: the name unblurs, then the rest rises in. */
  @keyframes reveal { from { opacity: 0; filter: blur(8px); } to { opacity: 1; filter: none; } }
  @keyframes up { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }
  @keyframes breathe { 0% { opacity: 1; } 40% { opacity: 0.65; } 100% { opacity: 1; } }
  .name { animation: reveal 0.75s ${EASE_ENTRANCE} both; }
  .loc { animation: up 0.42s ${EASE_ENTRANCE} 0.22s both; }
  .role { animation: up 0.42s ${EASE_ENTRANCE} 0.22s both, breathe 0.8s ${EASE_ENTRANCE} 0.55s forwards; }
  .tag { animation: up 0.42s ${EASE_ENTRANCE} 0.4s both; }
  .divider { animation: up 0.42s ${EASE_ENTRANCE} 0.54s both; }
  @media (prefers-reduced-motion: reduce) { * { animation: none !important; } }
</style>
<g clip-path="url(#card)">
  <rect width="${W}" height="${H}" fill="${p.bg}"/>
  <rect width="${W}" height="${H}" fill="url(#grid)"/>
</g>
<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="15.5" fill="none" stroke="${p.edge}"/>
<text class="name" x="500" y="126" text-anchor="middle">${t("display", "Eduard ")}<tspan class="em">${t("displayItalic", "Catalin")}</tspan>${t("display", " Dragu")}</text>
<g class="m-loc"><text class="loc" x="500" y="168" text-anchor="middle">${t("mono", "MILAN, ITALY")}</text></g>
<g class="m-role"><text class="role" x="500" y="194" text-anchor="middle">${t("mono", "PLATFORM ENGINEER")}</text></g>
<g class="m-tag"><text class="tag" x="500" y="240" text-anchor="middle">${t("display", "Vegan. Marathon runner. Occasionally on-call.")}</text></g>
<g class="divider">
  <path d="M436 278H490M510 278H564" stroke="${p.hairline}" stroke-width="1"/>
  <circle cx="500" cy="278" r="3" fill="${p.accent}"/>
</g>
</svg>`;
}

// ── Off-call: running, riding, lifting ──────────────────────────────────────

/** A smooth-enough profile, sampled every 6px. */
function profile(x0, x1, fy) {
  const pts = [];
  for (let x = x0; x <= x1; x += 6) pts.push([x, fy(x, (x - x0) / (x1 - x0))]);
  const d = "M" + pts.map(([x, y]) => `${x} ${y.toFixed(1)}`).join("L");
  return { d, end: pts.at(-1) };
}

function card(p, t, { x, index, label, title, body, art }) {
  return `<g transform="translate(${x} 0)">
  <rect x="0.5" y="0.5" width="311" height="255" rx="12" fill="${p.bg}" stroke="${p.edge}"/>
  <text class="label" x="24" y="40">${t("mono", `0${index} · ${label}`)}</text>
  <g class="m-title"><text class="title" x="24" y="84">${t("displayRegular", title)}</text></g>
  <text class="body" x="24" y="110">${t("sans", body)}</text>
  ${art}
</g>`;
}

const ticks = (t, labels) =>
  labels.map(([lx, anchor, s, cls = ""]) => `<text class="tick ${cls}" x="${lx}" y="230" text-anchor="${anchor}">${t("mono", s)}</text>`).join("");

/**
 * A line that draws itself in, then a dot that travels it. The dot fades out at the
 * finish and back in at the start, so the loop never visibly snaps back.
 */
function route(p, t, id, { d, end }, dur, labels) {
  const motion = `<animateMotion dur="${dur}s" begin="1.8s" repeatCount="indefinite" keyPoints="0;1;1" keyTimes="0;0.85;1" calcMode="linear"><mpath href="#${id}"/></animateMotion>`;
  return `<path d="${d}L288 206L24 206Z" fill="${p.accentDim}" class="fill"/>
  <path d="M24 206.5H288" stroke="${p.hairline}"/>
  <path id="${id}" d="${d}" pathLength="1" fill="none" stroke="${p.accent}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="draw"/>
  <g class="moving" opacity="0">
    <animate attributeName="opacity" values="0;1;1;0;0" keyTimes="0;0.04;0.85;0.95;1" dur="${dur}s" begin="1.8s" repeatCount="indefinite"/>
    <circle r="8" fill="${p.accentDim}">${motion}</circle>
    <circle r="4" fill="${p.accent}">${motion}</circle>
  </g>
  <circle class="static" cx="${end[0]}" cy="${end[1].toFixed(1)}" r="4" fill="${p.accent}"/>
  ${ticks(t, labels)}`;
}

function offCall(p, t) {
  // Rolling, mostly flat: a city marathon.
  const run = profile(24, 288, (x) => 184 - 8 * Math.sin(x * 0.04) - 4 * Math.sin(x * 0.09 + 1) - 1 * Math.sin(x * 0.2 + 2));
  // A climb that steepens towards the top.
  const ride = profile(24, 288, (x, k) => 200 - 50 * Math.pow(k, 1.6) - 2.5 * Math.sin(x * 0.19));

  // Loaded as on a real bar, from the sleeve's shoulder out: the big plate first, then
  // smaller ones. Centred at y=180 so the big plate rests on the floor line.
  const BAR_Y = 180;
  const plates = (side) => [[4, 16, p.fg], [10, 52, p.accent], [8, 40, p.muted], [6, 28, p.faint]]
    .reduce((acc, [w, h, fill], i, all) => {
      const offset = all.slice(0, i).reduce((s, [pw]) => s + pw + 2, 0);
      const px = side < 0 ? 100 - offset - w : 212 + offset;
      return acc + `<rect x="${px}" y="${BAR_Y - h / 2}" width="${w}" height="${h}" rx="2" fill="${fill}"/>`;
    }, "");
  const barbell = `<path d="M24 206.5H288" stroke="${p.hairline}"/>
  <g class="rep">
    <path d="M52 ${BAR_Y}H260" stroke="${p.muted}" stroke-width="3" stroke-linecap="round"/>
    ${plates(-1)}${plates(1)}
  </g>
  ${ticks(t, [[24, "start", "DEADLIFT"], [288, "end", "5×5"]])}`;

  const W = 1000, H = 256;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<style>
  /*FONTS*/
  text { white-space: pre; }
  .label { ${ff("mono")} font-size: 12px; letter-spacing: 0.12em; fill: ${p.accent}; }
  .title { ${ff("displayRegular")} font-size: 32px; letter-spacing: -0.01em; fill: ${p.fg}; }
  .body { ${ff("sans")} font-size: 15.5px; fill: ${p.muted}; }
  .tick { ${ff("mono")} font-size: 12px; letter-spacing: 0.08em; fill: ${p.faint}; }

  /* On a phone each card is ~110px wide: the one-liners go, labels and titles grow. */
  @media (max-width: 600px) {
    .body, .tick-mid { display: none; }
    .label { font-size: 26px; letter-spacing: 0.06em; }
    .title { font-size: 54px; }
    .tick { font-size: 22px; letter-spacing: 0.04em; }
    .m-title { transform: translateY(28px); }
  }

  @keyframes draw { from { stroke-dashoffset: 1; } to { stroke-dashoffset: 0; } }
  @keyframes fade { from { opacity: 0; } to { opacity: 1; } }
  .draw { stroke-dasharray: 1; stroke-dashoffset: 0; animation: draw 1.2s ${EASE_ENTRANCE} 0.3s both; }
  .fill { animation: fade 0.6s ${EASE_UI} 1.1s both; }
  .static { display: none; }

  /* A rep: hold on the floor, drive up, pause at lockout, lower. */
  @keyframes rep { 0%, 18% { transform: none; } 42%, 58% { transform: translateY(-24px); } 86%, 100% { transform: none; } }
  .rep { animation: rep 3.2s ${EASE_UI} 0.6s infinite; }

  /* SMIL ignores CSS, so the travelling dot is swapped for a still one at the finish. */
  @media (prefers-reduced-motion: reduce) {
    * { animation: none !important; }
    .moving { display: none; }
    .static { display: inline; }
  }
</style>
${card(p, t, { x: 0, index: 1, label: "RUN", title: "Marathons.", body: "Always training for the next one.", art: route(p, t, "run", run, 7, [[24, "start", "0"], [156, "middle", "21.1", "tick-mid"], [288, "end", "42.195 KM"]]) })}
${card(p, t, { x: 344, index: 2, label: "RIDE", title: "Long rides.", body: "In it for the climbs. And the coffee.", art: route(p, t, "ride", ride, 9, [[24, "start", "BASE"], [288, "end", "SUMMIT"]]) })}
${card(p, t, { x: 688, index: 3, label: "LIFT", title: "Hybrid.", body: "Lift heavy, then run anyway.", art: barbell })}
</svg>`;
}

// ── Buttons: the site's two CTAs ────────────────────────────────────────────

function button(label, { accent }) {
  return (p, t) => {
    // A transparent 4px gutter all round spaces the row (and the stack, once it wraps), so no &nbsp; is needed
    // between them in the README (where it would dangle when the row wraps on a phone).
    const W = 176, H = 54;
    const stroke = accent ? p.accent : p.borderStrong;
    const color = accent ? p.accent : p.fg;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<style>
  /*FONTS*/
  text { ${ff("sansMedium")} font-size: 14px; letter-spacing: 0.02em; fill: ${color}; white-space: pre; }
</style>
<rect x="4.5" y="4.5" width="${W - 9}" height="${H - 9}" rx="12" fill="${p.bg}" stroke="${stroke}"/>
<text x="${W / 2}" y="32" text-anchor="middle">${t("sansMedium", `${label}  →`)}</text>
</svg>`;
  };
}

// ── Build ───────────────────────────────────────────────────────────────────

const ASSETS = {
  header,
  "off-call": offCall,
  "button-site": button("eduarddragu.dev", { accent: true }),
  "button-resume": button("Resume", { accent: false }),
  "button-projects": button("Projects", { accent: false }),
};

await mkdir(new URL("../assets/", import.meta.url), { recursive: true });

for (const [name, template] of Object.entries(ASSETS)) {
  // Glyphs are the same in both themes, so the light render decides the subsets.
  const { t, used } = textRecorder();
  template(PALETTES.light, t);
  const faces = (await Promise.all(Object.entries(used).map(([key, chars]) => fontFace(key, chars)))).join("");

  for (const [theme, palette] of Object.entries(PALETTES)) {
    const svg = template(palette, textRecorder().t).replace("/*FONTS*/", faces);
    const file = new URL(`../assets/${name}-${theme}.svg`, import.meta.url);
    await writeFile(file, svg + "\n");
    console.log(`assets/${name}-${theme}.svg  ${(svg.length / 1024).toFixed(1)} KB`);
  }
}
