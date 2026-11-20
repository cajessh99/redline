// Writes the intake fixtures under tests/fixtures/intake/ from the one-sided fixture contract, using
// only Node built-ins, so they are reproducible and need no PDF or Word library to make.
//
//   node scripts/make-intake-fixtures.ts
//
// - one-sided-services-agreement.pdf: the whole fixture as a real text layer, three pages of
//   Helvetica, wrapped at about 88 characters, with extra space between paragraphs. Some lines are
//   drawn as two pieces with a kerning gap where the space would be, so the extractor has to put a
//   space back. Paragraphs run across page breaks.
// - scanned-services-agreement.pdf: two pages that are each one picture of text (drawn with a
//   small bitmap font) and no text layer, apart from a "Page 1 of 2" footer. This is what a
//   scanner or phone camera produces.
// - one-sided-services-agreement.docx: the fixture paragraph by paragraph, as a stored
//   (uncompressed) ZIP holding the minimal Word parts.
// - services-agreement.rtf: a format Redline does not accept.
//
// The writers are exported so tests can build edge cases (a page at the scanned threshold, a
// password-locked PDF) from the same code. Nothing here is a real contract.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

// ---------------------------------------------------------------------------------------------
// PDF

export type PdfImage = { name: string; width: number; height: number; gray: Uint8Array };
export type PdfPage = { content: string; images?: PdfImage[] };

/** Escapes a string for a PDF literal string. The fixture text is plain ASCII. */
export function pdfString(text: string): string {
  return `(${text.replace(/[\\()]/g, (c) => `\\${c}`)})`;
}

/**
 * A minimal PDF: catalog, page tree, one Helvetica font, and for each page a content stream and
 * any grayscale images (Flate-compressed). With `lockedWithPassword`, it carries a Standard
 * security handler whose /U value no empty password matches, so a reader has to ask for one.
 */
export function buildPdf(pages: PdfPage[], options: { lockedWithPassword?: boolean } = {}): Uint8Array {
  const objects: Buffer[] = [];
  const add = (body: Buffer | string) => {
    objects.push(typeof body === "string" ? Buffer.from(body, "latin1") : body);
    return objects.length; // object number
  };
  const stream = (dict: string, data: Buffer) =>
    Buffer.concat([
      Buffer.from(`<< ${dict} /Length ${data.length} >>\nstream\n`, "latin1"),
      data,
      Buffer.from("\nendstream", "latin1"),
    ]);

  const catalog = add(""); // filled in once the page tree number is known
  const pageTree = add("");
  const font = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  const kids: number[] = [];
  for (const page of pages) {
    const xobjects = (page.images ?? []).map((image) => {
      const data = deflateSync(Buffer.from(image.gray));
      const ref = add(
        stream(
          `/Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode`,
          data,
        ),
      );
      return `/${image.name} ${ref} 0 R`;
    });
    const content = add(stream("", Buffer.from(page.content, "latin1")));
    const resources = `<< /Font << /F1 ${font} 0 R >>${xobjects.length ? ` /XObject << ${xobjects.join(" ")} >>` : ""} >>`;
    kids.push(
      add(
        `<< /Type /Page /Parent ${pageTree} 0 R /MediaBox [0 0 612 792] /Resources ${resources} /Contents ${content} 0 R >>`,
      ),
    );
  }
  objects[catalog - 1] = Buffer.from(`<< /Type /Catalog /Pages ${pageTree} 0 R >>`, "latin1");
  objects[pageTree - 1] = Buffer.from(
    `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(" ")}] /Count ${kids.length} >>`,
    "latin1",
  );
  let encrypt = 0;
  if (options.lockedWithPassword) {
    // 32 fixed bytes for /O and /U. No password, empty or otherwise, hashes to this /U.
    const filler = Buffer.alloc(32, 0x5a).toString("hex");
    encrypt = add(`<< /Filter /Standard /V 1 /R 2 /O <${filler}> /U <${filler}> /P -44 >>`);
  }

  const parts: Buffer[] = [Buffer.from("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n", "latin1")];
  let offset = parts[0].length;
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(offset);
    const chunk = Buffer.concat([
      Buffer.from(`${i + 1} 0 obj\n`, "latin1"),
      body,
      Buffer.from("\nendobj\n", "latin1"),
    ]);
    parts.push(chunk);
    offset += chunk.length;
  });
  const xref = [
    "xref",
    `0 ${objects.length + 1}`,
    "0000000000 65535 f ",
    ...offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n `),
  ].join("\n");
  const id = "<52454400000000000000000000000001>";
  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R${encrypt ? ` /Encrypt ${encrypt} 0 R` : ""} /ID [${id} ${id}] >>\nstartxref\n${offset}\n%%EOF\n`;
  parts.push(Buffer.from(`${xref}\n${trailer}`, "latin1"));
  return new Uint8Array(Buffer.concat(parts));
}

/** Greedy word wrap at `width` characters. Rejoining the lines with one space gives the input. */
export function wrap(paragraph: string, width: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of paragraph.split(" ")) {
    if (line && line.length + 1 + word.length > width) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

const FONT_SIZE = 10;
const LEADING = 14; // baseline to baseline inside a paragraph
const PARAGRAPH_GAP = 10; // added between paragraphs
const TOP = 720;
const BOTTOM = 72;
const LEFT = 72;

/**
 * Lays paragraphs out as wrapped lines of 10pt Helvetica on as many Letter pages as they need.
 * A paragraph that does not fit is continued on the next page. Every third line that has a space
 * is drawn as two pieces with a kerning gap (a TJ adjustment of one space width) and no space
 * character between them.
 */
export function textPages(paragraphs: string[], wrapAt = 88): PdfPage[] {
  const pages: PdfPage[] = [];
  let ops: string[] = [];
  let y = TOP;
  let lineCount = 0;
  const newPage = () => {
    pages.push({ content: ops.join("\n") });
    ops = [];
    y = TOP;
  };
  paragraphs.forEach((paragraph, p) => {
    if (p > 0) y -= PARAGRAPH_GAP;
    for (const line of wrap(paragraph, wrapAt)) {
      if (y < BOTTOM) newPage();
      lineCount += 1;
      const space = line.indexOf(" ");
      const show =
        lineCount % 3 === 0 && space > 0
          ? `[${pdfString(line.slice(0, space))} -278 ${pdfString(line.slice(space + 1))}] TJ`
          : `${pdfString(line)} Tj`;
      ops.push(`BT /F1 ${FONT_SIZE} Tf ${LEFT} ${y} Td ${show} ET`);
      y -= LEADING;
    }
  });
  if (ops.length) newPage();
  return pages;
}

// A 5x7 bitmap font for the "scanned" page. Unknown characters draw as blanks.
const GLYPHS: Record<string, string> = {
  A: ".###.#...##...########...##...##...#",
  B: "####.#...##...#####.#...##...#####.",
  C: ".###.#...##....#....#....#...#.###.",
  D: "####.#...##...##...##...##...#####.",
  E: "######....#....####.#....#....#####",
  F: "######....#....####.#....#....#....",
  G: ".###.#...##....#.####...##...#.####",
  H: "#...##...##...#######...##...##...#",
  I: ".###...#....#....#....#....#...###.",
  J: "..###...#....#....#....##..#..##...",
  K: "#...##..#.#.#..##...#.#..#..#.#...#",
  L: "#....#....#....#....#....#....#####",
  M: "#...###.###.#.##.#.##...##...##...#",
  N: "#...##...###..##.#.##..###...##...#",
  O: ".###.#...##...##...##...##...#.###.",
  P: "####.#...##...#####.#....#....#....",
  Q: ".###.#...##...##...##.#.##..#..##.#",
  R: "####.#...##...#####.#.#..#..#.#...#",
  S: ".#####....#.....###.....#....#####.",
  T: "#####..#....#....#....#....#....#..",
  U: "#...##...##...##...##...##...#.###.",
  V: "#...##...##...##...##...#.#.#...#..",
  W: "#...##...##...##.#.##.#.##.#.#.#.#.",
  X: "#...##...#.#.#...#...#.#.#...##...#",
  Y: "#...##...#.#.#...#....#....#....#..",
  Z: "#####....#...#...#...#...#....#####",
};

/** Draws lines of capital letters into an 8-bit grayscale bitmap: black ink on white paper. */
export function bitmapOfText(lines: string[], scale = 2): PdfImage {
  const cellW = 6;
  const cellH = 10;
  const columns = Math.max(...lines.map((l) => l.length));
  const width = (columns * cellW + 2) * scale;
  const height = (lines.length * cellH + 2) * scale;
  const gray = new Uint8Array(width * height).fill(255);
  lines.forEach((line, row) => {
    [...line.toUpperCase()].forEach((ch, col) => {
      const glyph = GLYPHS[ch];
      if (!glyph) return;
      for (let gy = 0; gy < 7; gy++) {
        for (let gx = 0; gx < 5; gx++) {
          if (glyph[gy * 5 + gx] !== "#") continue;
          for (let sy = 0; sy < scale; sy++) {
            for (let sx = 0; sx < scale; sx++) {
              const px = (1 + col * cellW + gx) * scale + sx;
              const py = (1 + row * cellH + gy) * scale + sy;
              gray[py * width + px] = 0;
            }
          }
        }
      }
    });
  });
  return { name: "Scan", width, height, gray };
}

/** A page that is one picture of `lines`, filling the text area, with an optional text footer. */
export function scannedPage(lines: string[], footer?: string): PdfPage {
  const image = bitmapOfText(lines);
  const drawW = 468;
  const drawH = Math.round((drawW * image.height) / image.width);
  const ops = [`q ${drawW} 0 0 ${drawH} ${LEFT} ${TOP - drawH} cm /Scan Do Q`];
  if (footer) ops.push(`BT /F1 8 Tf 280 40 Td ${pdfString(footer)} Tj ET`);
  return { content: ops.join("\n"), images: [image] };
}

// ---------------------------------------------------------------------------------------------
// DOCX: a stored ZIP

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** A ZIP archive whose entries are stored uncompressed, with a fixed 1980-01-01 timestamp. */
export function storedZip(entries: { name: string; data: string }[]): Uint8Array {
  const local: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  const DOS_DATE = (0 << 9) | (1 << 5) | 1;
  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const data = Buffer.from(entry.data, "utf8");
    const crc = crc32(data);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4); // version needed
    header.writeUInt16LE(0x0800, 6); // flags: names are UTF-8
    header.writeUInt16LE(0, 8); // method: stored
    header.writeUInt16LE(0, 10); // time
    header.writeUInt16LE(DOS_DATE, 12);
    header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(data.length, 18);
    header.writeUInt32LE(data.length, 22);
    header.writeUInt16LE(name.length, 26);
    header.writeUInt16LE(0, 28);
    local.push(header, name, data);

    const dir = Buffer.alloc(46);
    dir.writeUInt32LE(0x02014b50, 0);
    dir.writeUInt16LE(20, 4); // version made by
    dir.writeUInt16LE(20, 6); // version needed
    dir.writeUInt16LE(0x0800, 8);
    dir.writeUInt16LE(0, 10);
    dir.writeUInt16LE(0, 12);
    dir.writeUInt16LE(DOS_DATE, 14);
    dir.writeUInt32LE(crc, 16);
    dir.writeUInt32LE(data.length, 20);
    dir.writeUInt32LE(data.length, 24);
    dir.writeUInt16LE(name.length, 28);
    dir.writeUInt32LE(offset, 42); // extra, comment, disk, attributes stay zero
    central.push(dir, name);

    offset += header.length + name.length + data.length;
  }
  const centralBytes = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBytes.length, 12);
  end.writeUInt32LE(offset, 16);
  return new Uint8Array(Buffer.concat([...local, centralBytes, end]));
}

const xmlEscape = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const run = (text: string, bold = false) =>
  `<w:r>${bold ? "<w:rPr><w:b/></w:rPr>" : ""}<w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r>`;

/**
 * A .docx with one Word paragraph per input paragraph. Short paragraphs (headings) are bold, and
 * long ones are split into two runs mid-sentence, the way Word stores text that has been edited.
 */
export function buildDocx(paragraphs: string[]): Uint8Array {
  const body = paragraphs
    .map((paragraph) => {
      if (paragraph.length < 60) return `<w:p>${run(paragraph, true)}</w:p>`;
      const cut = paragraph.indexOf(" ", Math.floor(paragraph.length / 2));
      return `<w:p>${run(paragraph.slice(0, cut))}${run(paragraph.slice(cut))}</w:p>`;
    })
    .join("");
  const w = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
  return storedZip([
    {
      name: "[Content_Types].xml",
      data:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
        "</Types>",
    },
    {
      name: "_rels/.rels",
      data:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
        "</Relationships>",
    },
    {
      name: "word/document.xml",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="${w}"><w:body>${body}</w:body></w:document>`,
    },
  ]);
}

// ---------------------------------------------------------------------------------------------

/** The fixture contract's paragraphs, split on blank lines, as the .txt file holds them. */
export function fixtureParagraphs(text: string): string[] {
  return text
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function main() {
  const root = new URL("../tests/fixtures/", import.meta.url);
  const out = new URL("intake/", root);
  mkdirSync(out, { recursive: true });
  const text = readFileSync(new URL("one-sided-services-agreement.txt", root), "utf8");
  const paragraphs = fixtureParagraphs(text);

  writeFileSync(new URL("one-sided-services-agreement.pdf", out), buildPdf(textPages(paragraphs)));
  writeFileSync(new URL("one-sided-services-agreement.docx", out), buildDocx(paragraphs));

  const scanLines = paragraphs
    .slice(0, 6)
    .flatMap((p) => wrap(p.replace(/[^A-Za-z ]/g, " ").replace(/ +/g, " "), 60))
    .slice(0, 40);
  writeFileSync(
    new URL("scanned-services-agreement.pdf", out),
    buildPdf([
      scannedPage(scanLines.slice(0, 20), "Page 1 of 2"),
      scannedPage(scanLines.slice(20), "Page 2 of 2"),
    ]),
  );

  writeFileSync(
    new URL("services-agreement.rtf", out),
    "{\\rtf1\\ansi\\deff0 {\\fonttbl {\\f0 Helvetica;}}\\f0\\fs20 INDEPENDENT CONTRACTOR SERVICES AGREEMENT\\par\\par This is a format Redline does not read.\\par}\n",
  );
  console.log(`Wrote intake fixtures to ${fileURLToPath(out)}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
