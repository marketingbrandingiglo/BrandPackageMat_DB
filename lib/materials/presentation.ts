import JSZip from "jszip";
import pptxgen from "pptxgenjs";
import { Resvg } from "@resvg/resvg-js";
import { escapeXml } from "@/lib/render/escape";
import { formatPhone, kitColors, type BrandKit, type KitColors } from "./kit";
import { placeLogo } from "./logo";
import { r, wrap, type TextStyle } from "./text";
import { placeVisual, visualAreaPng } from "./visual";

/**
 * Template PowerPoint 16:9 (SPEC bagian 5): theme asli (warna tema, font tema major/minor),
 * slide master dengan layout Judul, Bagian, Isi, Dua kolom, Penutup (logo di setiap layout),
 * plus satu slide contoh per layout. Dibuat dengan pptxgenjs lalu XML theme ditulis ulang
 * (warna dan font brand). Layout didefinisikan sekali sebagai data, dipakai untuk PPTX dan
 * pratinjau SVG (server tidak punya PowerPoint/LibreOffice).
 */
export const SLIDE = { w: 13.333, h: 7.5 }; // inci

type Font = "heading" | "body";
type El =
  | { t: "rect"; x: number; y: number; w: number; h: number; fill: string; radius?: number }
  | { t: "visual"; x: number; y: number; w: number; h: number }
  | { t: "logo"; x: number; y: number; w: number; h: number; align: "start" | "center" | "end"; plate?: boolean }
  | {
      t: "ph";
      name: string;
      kind: "title" | "body";
      x: number;
      y: number;
      w: number;
      h: number;
      size: number;
      color: string;
      font: Font;
      bold?: boolean;
      align?: "left" | "center";
      valign?: "top" | "middle" | "bottom";
      bullets?: boolean;
      prompt: string;
    };

interface Layout {
  name: string;
  bg: string;
  els: El[];
}

type Lines = string | string[];
interface Sample {
  layout: string;
  content: Record<string, Lines>;
}

const L = {
  id: {
    names: { title: "Judul", section: "Bagian", content: "Isi", two: "Dua kolom", closing: "Penutup" },
    promptTitle: "Klik untuk menambah judul",
    promptSub: "Klik untuk menambah subjudul",
    promptBody: "Klik untuk menambah teks",
    samples: {
      subtitle: "Profil Perusahaan",
      section: "Tentang Kami",
      sectionSub: "Bagian 01",
      contentTitle: "Layanan Kami",
      bullets: ["Poin pertama yang ingin disampaikan", "Poin kedua dengan penjelasan singkat", "Poin ketiga sebagai penutup bagian ini"],
      twoTitle: "Visi dan Misi",
      left: ["Visi perusahaan dalam satu kalimat", "Nilai yang dipegang tim"],
      right: ["Misi pertama", "Misi kedua", "Misi ketiga"],
      thanks: "Terima kasih",
    },
  },
  en: {
    names: { title: "Title", section: "Section", content: "Content", two: "Two columns", closing: "Closing" },
    promptTitle: "Click to add title",
    promptSub: "Click to add subtitle",
    promptBody: "Click to add text",
    samples: {
      subtitle: "Company Profile",
      section: "About Us",
      sectionSub: "Section 01",
      contentTitle: "Our Services",
      bullets: ["The first point to convey", "A second point with a short explanation", "A third point to close this section"],
      twoTitle: "Vision and Mission",
      left: ["The company vision in one sentence", "Values the team holds"],
      right: ["First mission", "Second mission", "Third mission"],
      thanks: "Thank you",
    },
  },
};

function layouts(kit: BrandKit, k: KitColors): Layout[] {
  const T = L[kit.lang];
  const isB = kit.pkg === "B";
  const W = SLIDE.w;
  const H = SLIDE.h;
  const vis = Boolean(kit.visual);
  const titlePh = (color: string, y = 0.5): El => ({ t: "ph", name: "judul", kind: "title", x: 0.8, y, w: 9.9, h: 0.9, size: 28, color, font: "heading", bold: true, valign: "bottom", prompt: T.promptTitle });
  const smallLogo: El = { t: "logo", x: W - 2.3, y: isB ? H - 1.0 : 0.55, w: 1.5, h: 0.6, align: "end" };
  const contentDecor: El[] = isB
    ? [
        { t: "rect", x: 0, y: 0, w: 0.22, h: H, fill: k.primary },
        { t: "rect", x: 0.8, y: 1.48, w: 0.8, h: 0.08, fill: k.accent },
      ]
    : [{ t: "rect", x: 0.8, y: 1.5, w: W - 1.6, h: 0.03, fill: k.primary }];

  const title: Layout = isB
    ? {
        name: T.names.title,
        bg: k.primary,
        els: [
          vis ? { t: "visual", x: W - 4.6, y: 0, w: 4.6, h: H } : { t: "rect", x: W - 1.6, y: 0, w: 1.6, h: H, fill: k.accent },
          { t: "logo", x: 0.8, y: 0.6, w: 3.0, h: 1.2, align: "start", plate: true },
          { t: "ph", name: "judul", kind: "title", x: 0.8, y: 2.7, w: vis ? 7.5 : 10.2, h: 1.6, size: 44, color: k.onPrimary, font: "heading", bold: true, valign: "bottom", prompt: T.promptTitle },
          { t: "ph", name: "subjudul", kind: "body", x: 0.8, y: 4.45, w: vis ? 7.5 : 10.2, h: 0.9, size: 20, color: k.onPrimary, font: "body", valign: "top", prompt: T.promptSub },
        ],
      }
    : {
        name: T.names.title,
        bg: "#FFFFFF",
        els: [
          { t: "rect", x: 0, y: H - 0.3, w: W, h: 0.3, fill: k.primary },
          ...(vis ? [{ t: "visual", x: W - 5.0, y: 0, w: 5.0, h: H - 0.3 } as El] : []),
          { t: "logo", x: 0.8, y: 0.6, w: 2.6, h: 1.0, align: "start" },
          { t: "ph", name: "judul", kind: "title", x: 0.8, y: 2.5, w: vis ? 7.1 : 11.7, h: 1.6, size: 40, color: k.dark, font: "heading", bold: true, valign: "bottom", prompt: T.promptTitle },
          { t: "rect", x: 0.8, y: 4.25, w: 1.2, h: 0.07, fill: k.primary },
          { t: "ph", name: "subjudul", kind: "body", x: 0.8, y: 4.45, w: vis ? 7.1 : 11.7, h: 0.9, size: 20, color: k.primaryText, font: "body", valign: "top", prompt: T.promptSub },
        ],
      };

  const section: Layout = isB
    ? {
        name: T.names.section,
        bg: k.dark,
        els: [
          { t: "rect", x: 0.8, y: 2.55, w: 1.0, h: 0.1, fill: k.accent },
          { t: "ph", name: "judul", kind: "title", x: 0.8, y: 2.8, w: 11.5, h: 1.4, size: 36, color: "#FFFFFF", font: "heading", bold: true, valign: "top", prompt: T.promptTitle },
          { t: "ph", name: "subjudul", kind: "body", x: 0.8, y: 4.25, w: 11.5, h: 0.7, size: 18, color: "#FFFFFF", font: "body", valign: "top", prompt: T.promptSub },
          { t: "logo", x: W - 2.6, y: H - 1.25, w: 1.8, h: 0.75, align: "end", plate: true },
        ],
      }
    : {
        name: T.names.section,
        bg: k.tint,
        els: [
          { t: "rect", x: 0, y: 0, w: 0.25, h: H, fill: k.primary },
          { t: "ph", name: "judul", kind: "title", x: 1.2, y: 2.6, w: 11, h: 1.4, size: 36, color: k.dark, font: "heading", bold: true, valign: "bottom", prompt: T.promptTitle },
          { t: "ph", name: "subjudul", kind: "body", x: 1.2, y: 4.15, w: 11, h: 0.7, size: 18, color: k.primaryText, font: "body", valign: "top", prompt: T.promptSub },
          { t: "logo", x: W - 2.3, y: H - 1.1, w: 1.5, h: 0.6, align: "end" },
        ],
      };

  const content: Layout = {
    name: T.names.content,
    bg: "#FFFFFF",
    els: [...contentDecor, titlePh(k.dark), { t: "ph", name: "isi", kind: "body", x: 0.8, y: 1.85, w: W - 1.6, h: H - 2.9, size: 18, color: k.dark, font: "body", valign: "top", bullets: true, prompt: T.promptBody }, smallLogo],
  };

  const two: Layout = {
    name: T.names.two,
    bg: "#FFFFFF",
    els: [
      ...contentDecor,
      titlePh(k.dark),
      { t: "ph", name: "kiri", kind: "body", x: 0.8, y: 1.85, w: 5.65, h: H - 2.9, size: 18, color: k.dark, font: "body", valign: "top", bullets: true, prompt: T.promptBody },
      { t: "ph", name: "kanan", kind: "body", x: 6.88, y: 1.85, w: 5.65, h: H - 2.9, size: 18, color: k.dark, font: "body", valign: "top", bullets: true, prompt: T.promptBody },
      smallLogo,
    ],
  };

  const closing: Layout = isB
    ? {
        name: T.names.closing,
        bg: k.primary,
        els: [
          vis ? { t: "visual", x: 0, y: H - 1.3, w: W, h: 1.3 } : { t: "rect", x: 0, y: H - 0.4, w: W, h: 0.4, fill: k.accent },
          { t: "logo", x: W / 2 - 1.6, y: 1.0, w: 3.2, h: 1.3, align: "center", plate: true },
          { t: "ph", name: "judul", kind: "title", x: 1, y: 2.85, w: W - 2, h: 1.2, size: 40, color: k.onPrimary, font: "heading", bold: true, align: "center", valign: "middle", prompt: T.promptTitle },
          { t: "ph", name: "kontak", kind: "body", x: 1.5, y: 4.2, w: W - 3, h: 1.6, size: 16, color: k.onPrimary, font: "body", align: "center", valign: "top", prompt: T.promptBody },
        ],
      }
    : {
        name: T.names.closing,
        bg: "#FFFFFF",
        els: [
          vis ? { t: "visual", x: 0, y: H - 1.4, w: W, h: 1.4 } : { t: "rect", x: 0, y: H - 0.3, w: W, h: 0.3, fill: k.primary },
          { t: "logo", x: W / 2 - 1.5, y: 1.0, w: 3.0, h: 1.2, align: "center" },
          { t: "ph", name: "judul", kind: "title", x: 1, y: 2.85, w: W - 2, h: 1.2, size: 40, color: k.primaryText, font: "heading", bold: true, align: "center", valign: "middle", prompt: T.promptTitle },
          { t: "ph", name: "kontak", kind: "body", x: 1.5, y: 4.2, w: W - 3, h: 1.6, size: 16, color: k.dark, font: "body", align: "center", valign: "top", prompt: T.promptBody },
        ],
      };

  return [title, section, content, two, closing];
}

function samples(kit: BrandKit): Sample[] {
  const T = L[kit.lang];
  const S = T.samples;
  const c = kit.company;
  const contact = [c.email, c.phone ? formatPhone(c.phone) : "", c.address].filter(Boolean);
  return [
    { layout: T.names.title, content: { judul: c.name, subjudul: S.subtitle } },
    { layout: T.names.section, content: { judul: S.section, subjudul: S.sectionSub } },
    { layout: T.names.content, content: { judul: S.contentTitle, isi: S.bullets } },
    { layout: T.names.two, content: { judul: S.twoTitle, kiri: S.left, kanan: S.right } },
    { layout: T.names.closing, content: { judul: S.thanks, kontak: contact.length ? contact : [c.name] } },
  ];
}

/* ---------------- Logo raster untuk PPTX ---------------- */

function logoPng(kit: BrandKit): Buffer {
  if (kit.logo.kind === "svg" && kit.logo.svg) return new Resvg(kit.logo.svg, { fitTo: { mode: "width", value: 1200 }, background: "rgba(0,0,0,0)" }).render().asPng();
  return kit.logo.png;
}

function fitBox(aspect: number, box: { x: number; y: number; w: number; h: number }, align: "start" | "center" | "end") {
  let w = box.w;
  let h = w / aspect;
  if (h > box.h) {
    h = box.h;
    w = h * aspect;
  }
  const x = align === "start" ? box.x : align === "end" ? box.x + box.w - w : box.x + (box.w - w) / 2;
  return { x, y: box.y + (box.h - h) / 2, w, h };
}

const hex = (c: string) => c.replace("#", "").toUpperCase();

/* ---------------- PPTX ---------------- */

export async function presentationPptx(kit: BrandKit): Promise<Buffer> {
  const k = kitColors(kit);
  const lays = layouts(kit, k);
  const png = `data:image/png;base64,${logoPng(kit).toString("base64")}`;
  const p = new pptxgen();
  p.layout = "LAYOUT_WIDE";
  p.title = `${kit.company.name} - template presentasi`;
  p.company = kit.company.name;
  p.author = "Brand Package Automation";

  for (const lay of lays) {
    const objects: pptxgen.SlideMasterProps["objects"] = [];
    for (const e of lay.els) {
      if (e.t === "rect") objects.push({ rect: { x: e.x, y: e.y, w: e.w, h: e.h, fill: { color: hex(e.fill) } } });
      else if (e.t === "visual") {
        if (kit.visual) objects.push({ image: { x: e.x, y: e.y, w: e.w, h: e.h, data: `data:image/png;base64,${visualAreaPng(kit.visual, e.w, e.h, Math.round(e.w * 200)).toString("base64")}` } });
      } else if (e.t === "logo") {
        const pad = e.plate ? 0.18 : 0;
        if (e.plate) objects.push({ text: { text: "", options: { x: e.x, y: e.y, w: e.w, h: e.h, shape: p.ShapeType.roundRect, rectRadius: 0.12, fill: { color: "FFFFFF" }, line: { color: "FFFFFF", width: 0 } } } });
        const b = fitBox(kit.logo.aspect, { x: e.x + pad, y: e.y + pad, w: e.w - 2 * pad, h: e.h - 2 * pad }, e.plate ? "center" : e.align);
        objects.push({ image: { ...b, data: png } });
      } else {
        objects.push({
          placeholder: {
            options: {
              name: e.name,
              type: e.kind,
              x: e.x,
              y: e.y,
              w: e.w,
              h: e.h,
              fontSize: e.size,
              color: hex(e.color),
              bold: e.bold,
              align: e.align ?? "left",
              valign: e.valign ?? "top",
              margin: 0,
            },
            text: e.prompt,
          },
        });
      }
    }
    p.defineSlideMaster({ title: lay.name, background: { color: hex(lay.bg) }, objects });
  }

  for (const s of samples(kit)) {
    const slide = p.addSlide({ masterName: s.layout });
    const lay = lays.find((x) => x.name === s.layout)!;
    for (const e of lay.els) {
      if (e.t !== "ph") continue;
      const v = s.content[e.name];
      if (!v) continue;
      if (Array.isArray(v)) slide.addText(v.map((t) => ({ text: t, options: { bullet: e.bullets ? true : false, breakLine: true } })), { placeholder: e.name });
      else slide.addText(v, { placeholder: e.name });
    }
  }

  const buf = (await p.write({ outputType: "nodebuffer" })) as Buffer;
  return patchTheme(buf, kit, k);
}

/** Tulis ulang theme: skema warna dan skema font brand (font tema major = heading, minor = teks isi). */
async function patchTheme(buf: Buffer, kit: BrandKit, k: KitColors): Promise<Buffer> {
  const zip = await JSZip.loadAsync(buf);
  const path = "ppt/theme/theme1.xml";
  let xml = await zip.file(path)!.async("string");
  const pack = kit.palette.packages[kit.pkg].supporting;
  const c = (v: string) => `<a:srgbClr val="${hex(v)}"/>`;
  const name = escapeXml(`${kit.company.name} ${kit.pkg}`);
  const clr = `<a:clrScheme name="${name}"><a:dk1>${c(k.dark)}</a:dk1><a:lt1>${c("#FFFFFF")}</a:lt1><a:dk2>${c(k.primaryText)}</a:dk2><a:lt2>${c(k.tint)}</a:lt2><a:accent1>${c(k.primary)}</a:accent1><a:accent2>${c(k.accent)}</a:accent2><a:accent3>${c(pack[1]?.hex ?? k.primaryText)}</a:accent3><a:accent4>${c(k.mid)}</a:accent4><a:accent5>${c(k.primaryText)}</a:accent5><a:accent6>${c(k.light)}</a:accent6><a:hlink>${c(k.primaryText)}</a:hlink><a:folHlink>${c(k.mid)}</a:folHlink></a:clrScheme>`;
  xml = xml.replace(/<a:clrScheme[\s\S]*?<\/a:clrScheme>/, clr);
  xml = xml.replace(/<a:fontScheme name="[^"]*">/, `<a:fontScheme name="${name}">`);
  xml = xml.replace(/(<a:majorFont>\s*)<a:latin [^>]*\/>/, `$1<a:latin typeface="${escapeXml(kit.fonts.heading.family)}"/>`);
  xml = xml.replace(/(<a:minorFont>\s*)<a:latin [^>]*\/>/, `$1<a:latin typeface="${escapeXml(kit.fonts.body.family)}"/>`);
  xml = xml.replace(/<a:theme ([^>]*)name="[^"]*"/, `<a:theme $1name="${name}"`);
  zip.file(path, xml);
  // Layout bawaan pptxgenjs "DEFAULT" diberi nama yang jelas.
  for (const f of Object.keys(zip.files).filter((n) => /^ppt\/slideLayouts\/slideLayout\d+\.xml$/.test(n))) {
    const lx = await zip.file(f)!.async("string");
    if (lx.includes('<p:cSld name="DEFAULT"')) zip.file(f, lx.replace('<p:cSld name="DEFAULT"', `<p:cSld name="${kit.lang === "id" ? "Kosong" : "Blank"}"`));
  }
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

/* ---------------- Pratinjau SVG (satu per slide contoh) ---------------- */

export function presentationPreviews(kit: BrandKit): string[] {
  const k = kitColors(kit);
  const lays = layouts(kit, k);
  const PT = 1 / 72; // inci per poin
  return samples(kit).map((s) => {
    const lay = lays.find((x) => x.name === s.layout)!;
    const parts: string[] = [`<rect width="${SLIDE.w}" height="${SLIDE.h}" fill="${lay.bg}"/>`];
    for (const e of lay.els) {
      if (e.t === "rect") parts.push(`<rect x="${r(e.x)}" y="${r(e.y)}" width="${r(e.w)}" height="${r(e.h)}" fill="${e.fill}"/>`);
      else if (e.t === "visual") {
        if (kit.visual) parts.push(placeVisual(kit.visual, e, "slide"));
      } else if (e.t === "logo") {
        const pad = e.plate ? 0.18 : 0;
        if (e.plate) parts.push(`<rect x="${r(e.x)}" y="${r(e.y)}" width="${r(e.w)}" height="${r(e.h)}" rx="0.12" fill="#FFFFFF"/>`);
        parts.push(placeLogo(kit.logo, { x: e.x + pad, y: e.y + pad, w: e.w - 2 * pad, h: e.h - 2 * pad }, e.plate ? "center" : e.align).svg);
      } else {
        const v = s.content[e.name];
        if (!v) continue;
        const font = e.font === "heading" ? kit.fonts.heading : kit.fonts.body;
        const size = e.size * PT;
        const st: TextStyle = { font, bold: e.bold, size, color: e.color, anchor: e.align === "center" ? "middle" : "start" };
        const bullet = Array.isArray(v) && e.bullets;
        const items = Array.isArray(v) ? v : [v];
        const lines = items.flatMap((t, i) => wrap(t, st, e.w - (bullet ? 0.4 : 0), 3).map((l, j) => ({ l, first: j === 0, item: i })));
        const lh = size * 1.25;
        const gap = bullet ? size * 0.5 : 0;
        const total = lines.length * lh + (items.length - 1) * gap;
        let y = e.valign === "bottom" ? e.y + e.h - total + size : e.valign === "middle" ? e.y + (e.h - total) / 2 + size : e.y + size;
        let prev = 0;
        for (const ln of lines) {
          if (ln.item !== prev) {
            y += gap;
            prev = ln.item;
          }
          const x = e.align === "center" ? e.x + e.w / 2 : e.x + (bullet ? 0.4 : 0);
          if (bullet && ln.first) parts.push(`<circle cx="${r(e.x + 0.12)}" cy="${r(y - size * 0.33)}" r="${r(size * 0.14)}" fill="${e.color}"/>`);
          parts.push(`<text x="${r(x)}" y="${r(y)}" font-family="${escapeXml(font.family)}"${e.bold ? ' font-weight="bold"' : ""} font-size="${r(size)}" fill="${e.color}"${e.align === "center" ? ' text-anchor="middle"' : ""}>${escapeXml(ln.l)}</text>`);
          y += lh;
        }
      }
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${SLIDE.w}in" height="${SLIDE.h}in" viewBox="0 0 ${SLIDE.w} ${SLIDE.h}">${parts.join("")}</svg>`;
  });
}
