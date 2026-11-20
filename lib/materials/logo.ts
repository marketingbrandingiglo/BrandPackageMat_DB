import { r } from "./text";
import type { KitLogo } from "./kit";

/**
 * Logo di dalam template: SVG disisipkan sebagai <svg> bersarang (tetap vektor di PDF dan
 * Illustrator), PNG sebagai <image>. Ukuran dihitung dari rasio logo agar pas di kotak.
 */
export interface Placed {
  svg: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export function inner(svg: string, prefix = "lg-"): { viewBox: string; body: string } {
  const open = /<svg\b[^>]*>/i.exec(svg);
  const close = svg.lastIndexOf("</svg>");
  if (!open || close < 0) throw new Error("SVG logo tidak valid");
  const tag = open[0];
  let viewBox = /viewBox="([^"]+)"/i.exec(tag)?.[1];
  if (!viewBox) {
    const w = parseFloat(/\bwidth="([\d.]+)/i.exec(tag)?.[1] ?? "100");
    const h = parseFloat(/\bheight="([\d.]+)/i.exec(tag)?.[1] ?? "100");
    viewBox = `0 0 ${w} ${h}`;
  }
  let body = svg.slice(open.index + tag.length, close);
  // Awali id supaya tidak bentrok dengan id template (gradien, clipPath, dll.).
  body = body
    .replace(/\bid="([^"]+)"/g, `id="${prefix}$1"`)
    .replace(/url\(#([^)]+)\)/g, `url(#${prefix}$1)`)
    .replace(/(xlink:href|href)="#([^"]+)"/g, `$1="#${prefix}$2"`);
  return { viewBox, body };
}

export function placeLogo(logo: KitLogo, box: { x: number; y: number; w: number; h: number }, align: "start" | "center" | "end" = "center", valign: "top" | "middle" | "bottom" = "middle"): Placed {
  let w = box.w;
  let h = w / logo.aspect;
  if (h > box.h) {
    h = box.h;
    w = h * logo.aspect;
  }
  const x = align === "start" ? box.x : align === "end" ? box.x + box.w - w : box.x + (box.w - w) / 2;
  const y = valign === "top" ? box.y : valign === "bottom" ? box.y + box.h - h : box.y + (box.h - h) / 2;
  if (logo.kind === "svg" && logo.svg) {
    const { viewBox, body } = inner(logo.svg);
    return { x, y, w, h, svg: `<svg x="${r(x)}" y="${r(y)}" width="${r(w)}" height="${r(h)}" viewBox="${viewBox}" preserveAspectRatio="xMidYMid meet">${body}</svg>` };
  }
  return {
    x,
    y,
    w,
    h,
    svg: `<image x="${r(x)}" y="${r(y)}" width="${r(w)}" height="${r(h)}" preserveAspectRatio="xMidYMid meet" xlink:href="data:image/png;base64,${logo.png.toString("base64")}"/>`,
  };
}
