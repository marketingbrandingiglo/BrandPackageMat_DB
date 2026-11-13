"use client";

/** Muat file font katalog (lewat route admin) ke document.fonts. Mengembalikan nama family CSS. */
const loaded = new Map<string, Promise<string>>();

export function loadCatalogFont(regular: string, bold?: string): Promise<string> {
  const name = `bpa-${regular.split("/")[0]}`;
  let p = loaded.get(name);
  if (!p) {
    const url = (rel: string) => `/admin/lab/font/file/${rel}`;
    const faces = [new FontFace(name, `url(${url(regular)})`, { weight: "400" })];
    if (bold) faces.push(new FontFace(name, `url(${url(bold)})`, { weight: "700" }));
    p = Promise.all(faces.map((f) => f.load())).then((xs) => {
      xs.forEach((f) => document.fonts.add(f));
      return name;
    });
    p.catch(() => loaded.delete(name));
    loaded.set(name, p);
  }
  return p;
}
