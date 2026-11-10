declare module "svg-to-pdfkit" {
  interface Options {
    width?: number;
    height?: number;
    preserveAspectRatio?: string;
    useCSS?: boolean;
    assumePt?: boolean;
    precision?: number;
    warningCallback?: (msg: string) => void;
    fontCallback?: (family: string, bold: boolean, italic: boolean, opts: { fauxBold?: boolean }) => string;
    imageCallback?: (link: string) => string | Buffer;
  }
  export default function SVGtoPDF(
    doc: PDFKit.PDFDocument,
    svg: string,
    x?: number,
    y?: number,
    options?: Options,
  ): void;
}
