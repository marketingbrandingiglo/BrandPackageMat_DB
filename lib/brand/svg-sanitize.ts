import { DOMParser, XMLSerializer, type Element as XElement, type Node as XNode } from "@xmldom/xmldom";

const SVG_NS = "http://www.w3.org/2000/svg";
const XLINK_NS = "http://www.w3.org/1999/xlink";

/** Elemen SVG yang diizinkan. Selain ini dibuang (SPEC bagian 3 dan 12). */
const ALLOWED = new Set([
  "svg", "g", "defs", "symbol", "use", "path", "rect", "circle", "ellipse", "line", "polyline", "polygon",
  "text", "tspan", "textPath", "linearGradient", "radialGradient", "stop", "clipPath", "mask", "pattern",
  "image", "title", "desc", "style", "switch", "marker",
  "filter", "feGaussianBlur", "feOffset", "feBlend", "feColorMatrix", "feComposite", "feFlood", "feMerge",
  "feMergeNode", "feMorphology", "feComponentTransfer", "feFuncA", "feFuncR", "feFuncG", "feFuncB",
]);
/** Elemen yang dibuang beserta isinya. Elemen tak dikenal lain juga dibuang. */
const DANGEROUS = new Set(["script", "foreignObject", "iframe", "object", "embed", "audio", "video", "animate", "animateMotion", "animateTransform", "set", "handler", "listener"]);
const SAFE_DATA_IMAGE = /^data:image\/(png|jpe?g|gif|webp);base64,[a-z0-9+/=\s]+$/i;

export interface SanitizeResult {
  svg: string;
  /** Daftar yang dibuang, untuk laporan ke user. */
  removed: string[];
  hasText: boolean;
  hasRaster: boolean;
  hasFilter: boolean;
  viewBox: [number, number, number, number] | null;
  width: number | null;
  height: number | null;
}

export class SvgRejected extends Error {}

function cleanCss(css: string, removed: string[]): string {
  let out = css;
  if (/@import/i.test(out)) {
    out = out.replace(/@import[^;]*;?/gi, "");
    removed.push("@import di CSS");
  }
  // url(...) hanya boleh menunjuk ke elemen di dokumen yang sama (#id).
  out = out.replace(/url\(\s*(['"]?)(?!#)[^)]*\1\s*\)/gi, () => {
    removed.push("url() eksternal di CSS");
    return "none";
  });
  if (/expression\s*\(|javascript:|behavior\s*:/i.test(out)) {
    out = out.replace(/expression\s*\(|javascript:|behavior\s*:/gi, "");
    removed.push("ekspresi berbahaya di CSS");
  }
  return out;
}

function num(v: string | null): number | null {
  if (!v) return null;
  const n = parseFloat(v);
  return Number.isFinite(n) && !v.trim().endsWith("%") ? n : null;
}

/**
 * Sanitasi SVG unggahan: buang script, event handler, referensi eksternal,
 * foreignObject, animasi, dan elemen tak dikenal. DTD dengan entity ditolak.
 */
export function sanitizeSvg(input: string): SanitizeResult {
  if (/<!ENTITY/i.test(input) || /<!DOCTYPE[^>]*\[/i.test(input)) {
    throw new SvgRejected("SVG berisi deklarasi DTD/entity dan tidak bisa diproses.");
  }
  const src = input.replace(/<!DOCTYPE[^>]*>/gi, "");
  const errors: string[] = [];
  const doc = new DOMParser({
    onError: (level, msg) => {
      if (level !== "warning") errors.push(String(msg));
    },
  }).parseFromString(src, "image/svg+xml");
  const root = doc.documentElement;
  if (!root || root.localName !== "svg" || errors.length) {
    throw new SvgRejected("File bukan SVG yang valid.");
  }

  const removed: string[] = [];
  let hasText = false;
  let hasRaster = false;
  let hasFilter = false;

  const walk = (el: XElement) => {
    // Salin dulu karena daftar berubah saat elemen dibuang.
    const children = Array.from(el.childNodes as unknown as ArrayLike<XNode>);
    for (const node of children) {
      if (node.nodeType === 7 || node.nodeType === 8) {
        // processing instruction / komentar
        el.removeChild(node);
        continue;
      }
      if (node.nodeType !== 1) continue;
      const child = node as XElement;
      const name = child.localName ?? child.nodeName;
      const inSvgNs = !child.namespaceURI || child.namespaceURI === SVG_NS;
      if (!inSvgNs || !ALLOWED.has(name)) {
        removed.push(DANGEROUS.has(name) ? `<${name}>` : `<${child.nodeName}> (tidak dikenal)`);
        el.removeChild(child);
        continue;
      }
      cleanAttributes(child, removed);
      if (name === "image") {
        const href = child.getAttribute("href") ?? child.getAttributeNS(XLINK_NS, "href");
        if (!href || !SAFE_DATA_IMAGE.test(href)) {
          removed.push("<image> dengan sumber eksternal");
          el.removeChild(child);
          continue;
        }
        hasRaster = true;
      }
      if (name === "use") {
        const href = child.getAttribute("href") ?? child.getAttributeNS(XLINK_NS, "href");
        if (!href || !href.startsWith("#")) {
          removed.push("<use> ke file eksternal");
          el.removeChild(child);
          continue;
        }
      }
      if (name === "style") {
        const css = child.textContent ?? "";
        const clean = cleanCss(css, removed);
        if (clean !== css) {
          while (child.firstChild) child.removeChild(child.firstChild);
          child.appendChild(doc.createTextNode(clean));
        }
      }
      if (name === "text" || name === "tspan" || name === "textPath") hasText = true;
      if (name === "filter") hasFilter = true;
      walk(child);
    }
  };

  cleanAttributes(root, removed);
  walk(root);

  const vb = (root.getAttribute("viewBox") ?? "").trim().split(/[\s,]+/).map(Number);
  const viewBox = vb.length === 4 && vb.every(Number.isFinite) && vb[2] > 0 && vb[3] > 0 ? (vb as [number, number, number, number]) : null;

  return {
    svg: new XMLSerializer().serializeToString(doc),
    removed: [...new Set(removed)],
    hasText,
    hasRaster,
    hasFilter,
    viewBox,
    width: num(root.getAttribute("width")),
    height: num(root.getAttribute("height")),
  };
}

function cleanAttributes(el: XElement, removed: string[]) {
  const attrs = Array.from(el.attributes as unknown as ArrayLike<{ name: string; value: string; namespaceURI: string | null; localName: string }>);
  for (const a of attrs) {
    const name = a.name;
    const lower = name.toLowerCase();
    const value = a.value ?? "";
    if (lower.startsWith("on")) {
      removed.push(`atribut ${name}`);
      el.removeAttribute(name);
      continue;
    }
    if (/^\s*(javascript|vbscript):/i.test(value) || /^\s*data:text\/html/i.test(value)) {
      removed.push(`atribut ${name} berbahaya`);
      el.removeAttribute(name);
      continue;
    }
    if (a.localName === "href" && el.localName !== "image" && !value.startsWith("#")) {
      removed.push(`tautan eksternal (${name})`);
      el.removeAttribute(name);
      continue;
    }
    if (lower === "style") {
      const clean = cleanCss(value, removed);
      if (clean !== value) el.setAttribute(name, clean);
      continue;
    }
    // url(...) di atribut presentasi (fill, filter, clip-path, mask) hanya boleh lokal.
    if (/url\(/i.test(value) && !/^\s*url\(\s*['"]?#/i.test(value)) {
      removed.push(`url() eksternal di ${name}`);
      el.removeAttribute(name);
    }
  }
}
