import { Resvg } from "@resvg/resvg-js";
import { VISUAL_SIZE } from "@/lib/brand/visual";
import { inner } from "./logo";
import { r } from "./text";

/**
 * Tahap 5: menempatkan aset dekoratif di area sendiri pada materi. Aset persegi dipotong
 * (slice, rata tengah) sesuai rasio area dan dibatasi clipPath, jadi tidak menimpa logo/teks.
 * Tetap vektor di SVG/PDF; PPTX memakai PNG hasil render area yang sama.
 */
export interface Area {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function placeVisual(svg: string, a: Area, id: string, opts: { radius?: number; align?: string } = {}): string {
  const { body } = inner(svg, `vs-${id}-`);
  const rx = opts.radius ? ` rx="${r(opts.radius)}"` : "";
  return (
    `<g id="visual-${id}"><defs><clipPath id="klip-${id}"><rect x="${r(a.x)}" y="${r(a.y)}" width="${r(a.w)}" height="${r(a.h)}"${rx}/></clipPath></defs>` +
    `<g clip-path="url(#klip-${id})"><svg x="${r(a.x)}" y="${r(a.y)}" width="${r(a.w)}" height="${r(a.h)}" viewBox="0 0 ${VISUAL_SIZE} ${VISUAL_SIZE}" preserveAspectRatio="${opts.align ?? "xMidYMid"} slice">${body}</svg></g></g>`
  );
}

/** PNG area aset (untuk PPTX), lebar `px`. */
export function visualAreaPng(svg: string, w: number, h: number, px: number, background?: string): Buffer {
  const doc = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${background ? `<rect width="${w}" height="${h}" fill="${background}"/>` : ""}${placeVisual(svg, { x: 0, y: 0, w, h }, "ppt")}</svg>`;
  return new Resvg(doc, { fitTo: { mode: "width", value: px }, background: "rgba(0,0,0,0)" }).render().asPng();
}
