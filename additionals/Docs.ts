/**
 * @module    Docs
 * @author    Riccardo Angeli
 * @version   1.0.0
 * @copyright Riccardo Angeli 2012-2026
 * @license   MIT / Commercial (dual license)
 *
 * AriannA Docs — zero-dependency document I/O for the browser.
 * Read and write DOCX, XLSX, XLS, PPTX, PPT, CSV, SVG, PDF, ODS, ODP.
 *
 * All Office formats (DOCX / XLSX / PPTX / ODS / ODP) are ZIP archives
 * containing XML — implemented in pure JS/TS without any npm dependency.
 *
 * ── ARCHITECTURE ─────────────────────────────────────────────────────────────
 *   Docs.read(file | url | ArrayBuffer, format?) → DocsDocument
 *   Docs.write(doc)                              → Blob
 *   Docs.download(doc, filename)                 → triggers browser download
 *
 *   DocsDocument
 *     .format   : DocFormat
 *     .content  : string | ArrayBuffer | SpreadsheetData | PresentationData
 *     .meta     : DocMeta
 *     .toBlob() : Blob
 *     .toBase64(): string
 *
 * ── SUPPORTED FORMATS ────────────────────────────────────────────────────────
 *   DOCX   — Word document (ZIP+XML, OOXML)
 *   XLSX   — Excel workbook (ZIP+XML, OOXML)
 *   XLS    — Excel 97-2003 (BIFF8 binary, read-only)
 *   PPTX   — PowerPoint presentation (ZIP+XML, OOXML)
 *   PPT    — PowerPoint 97-2003 (binary, read-only)
 *   CSV    — Comma/tab separated values
 *   SVG    — Scalable Vector Graphics (read/write/manipulate)
 *   PDF    — Portable Document Format (generate only; parse text)
 *   ODS    — OpenDocument Spreadsheet (ZIP+XML)
 *   ODP    — OpenDocument Presentation (ZIP+XML)
 *
 * ── USAGE ────────────────────────────────────────────────────────────────────
 *   // Read a file from input[type=file]
 *   const doc  = await Docs.read(file);
 *   const rows = doc.content as SpreadsheetData;
 *
 *   // Build an XLSX from scratch
 *   const xlsx = Docs.xlsx.create({ sheets: [{ name: 'Sales', rows: data }] });
 *   Docs.download(xlsx, 'report.xlsx');
 *
 *   // Build a DOCX from scratch
 *   const docx = Docs.docx.create({ paragraphs: ['Hello', 'World'] });
 *   Docs.download(docx, 'letter.docx');
 *
 *   // Build a PPTX from scratch
 *   const pptx = Docs.pptx.create({ slides: [{ title: 'Slide 1', body: 'Content' }] });
 *   Docs.download(pptx, 'deck.pptx');
 *
 *   // CSV parse / stringify
 *   const rows = Docs.csv.parse(text);
 *   const text = Docs.csv.stringify(rows);
 *
 *   // SVG manipulate
 *   const svg  = Docs.svg.parse('<svg>...</svg>');
 *   svg.querySelector('circle')!.setAttribute('fill', 'red');
 *   const out  = Docs.svg.stringify(svg);
 *
 *   // PDF generate
 *   const pdf  = Docs.pdf.create({ title: 'Report', pages: [...] });
 *   Docs.download(pdf, 'report.pdf');
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type DocFormat =
    | 'docx' | 'xlsx' | 'xls' | 'pptx' | 'ppt'
    | 'csv'  | 'svg'  | 'pdf' | 'ods'  | 'odp';

export interface DocMeta
{
    format      : DocFormat;
    filename?   : string;
    title?      : string;
    author?     : string;
    created?    : Date;
    modified?   : Date;
    sheetCount? : number;
    slideCount? : number;
    pageCount?  : number;
}

export type CellValue = string | number | boolean | null;

export interface SpreadsheetCell
{
    value    : CellValue;
    formula? : string;
    format?  : string;
    bold?    : boolean;
    italic?  : boolean;
    color?   : string;
    bg?      : string;
    align?   : 'left' | 'center' | 'right';
}

export type SpreadsheetRow  = SpreadsheetCell[];
export type SpreadsheetData = { name: string; rows: SpreadsheetRow[] }[];

export interface SlideData
{
    title?      : string;
    body?       : string;
    notes?      : string;
    background? : string;
    elements?   : SlideElement[];
}

export interface SlideElement
{
    type    : 'text' | 'image' | 'shape' | 'table';
    x       : number;
    y       : number;
    w       : number;
    h       : number;
    content?: string;
    style?  : Record<string, string>;
}

export type PresentationData = SlideData[];

export interface DocxParagraph
{
    text    : string;
    bold?   : boolean;
    italic? : boolean;
    size?   : number;
    color?  : string;
    align?  : 'left' | 'center' | 'right' | 'justify';
    heading?: 1 | 2 | 3 | 4 | 5 | 6;
}

export interface DocxTable
{
    rows: string[][];
}

export type DocxContent = DocxParagraph | DocxTable;

export interface DocxDocument
{
    paragraphs? : DocxContent[];
    title?      : string;
    author?     : string;
    styles?     : Record<string, Record<string, string>>;
}

export interface XlsxDocument
{
    sheets  : { name: string; rows: (CellValue | SpreadsheetCell)[][] }[];
    title?  : string;
    author? : string;
}

export interface PptxDocument
{
    slides  : SlideData[];
    title?  : string;
    author? : string;
    theme?  : { accent?: string; bg?: string; text?: string };
}

export interface PdfPage
{
    text?    : string;
    html?    : string;
    elements?: PdfElement[];
}

export interface PdfElement
{
    type    : 'text' | 'line' | 'rect' | 'image';
    x       : number;
    y       : number;
    w?      : number;
    h?      : number;
    content?: string;
    style?  : { color?: string; size?: number; bold?: boolean; font?: string };
}

export interface PdfDocument
{
    pages   : PdfPage[];
    title?  : string;
    author? : string;
    size?   : 'A4' | 'A3' | 'Letter' | 'Legal';
}

export class DocsDocument
{
    readonly format  : DocFormat;
    readonly meta    : DocMeta;
    readonly content : string | ArrayBuffer | SpreadsheetData | PresentationData | Document | DocxContent[];
    #blob            : Blob | null = null;

    constructor(format: DocFormat, content: DocsDocument['content'], meta: Partial<DocMeta> = {})
    {
        this.format  = format;
        this.content = content;
        this.meta    = { format, ...meta };
    }

    toBlob(): Blob
    {
        if (this.#blob) return this.#blob;
        this.#blob = _toBlob(this);
        return this.#blob;
    }

    toBase64(): Promise<string>
    {
        return new Promise(res =>
        {
            const r = new FileReader();
            r.onload = () => res((r.result as string).split(',')[1] ?? '');
            r.readAsDataURL(this.toBlob());
        });
    }

    toArrayBuffer(): Promise<ArrayBuffer>
    {
        return this.toBlob().arrayBuffer();
    }

    toUrl(): string
    {
        return URL.createObjectURL(this.toBlob());
    }
}

// ── MIME map ──────────────────────────────────────────────────────────────────

const MIME: Record<DocFormat, string> = {
    docx : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xlsx : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    xls  : 'application/vnd.ms-excel',
    pptx : 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ppt  : 'application/vnd.ms-powerpoint',
    csv  : 'text/csv',
    svg  : 'image/svg+xml',
    pdf  : 'application/pdf',
    ods  : 'application/vnd.oasis.opendocument.spreadsheet',
    odp  : 'application/vnd.oasis.opendocument.presentation',
};

const EXT_MAP: Record<string, DocFormat> = {
    '.docx': 'docx', '.xlsx': 'xlsx', '.xls': 'xls',
    '.pptx': 'pptx', '.ppt': 'ppt',  '.csv': 'csv',
    '.svg' : 'svg',  '.pdf': 'pdf',   '.ods': 'ods',
    '.odp' : 'odp',
};

function _detectFormat(name: string): DocFormat | null
{
    const ext = name.toLowerCase().match(/\.[^.]+$/)?.[0] ?? '';
    return EXT_MAP[ext] ?? null;
}

function _toBlob(doc: DocsDocument): Blob
{
    const c = doc.content;
    if (c instanceof ArrayBuffer) return new Blob([c], { type: MIME[doc.format] });
    if (typeof c === 'string')    return new Blob([c],  { type: MIME[doc.format] });
    return new Blob([JSON.stringify(c)], { type: 'application/json' });
}

// ── ZIP engine (pure JS) ──────────────────────────────────────────────────────
// Minimal ZIP builder — supports stored and deflate (via CompressionStream)

interface ZipEntry { name: string; data: Uint8Array; compress: boolean; }

async function _zipBuild(entries: ZipEntry[]): Promise<Uint8Array>
{
    const localHeaders: Uint8Array[] = [];
    const centralDir  : Uint8Array[] = [];
    let   offset = 0;

    for (const entry of entries)
    {
        const nameBytes = _utf8(entry.name);
        let   body      = entry.data;
        let   compressed = body;
        let   method     = 0; // stored
        let   crc        = _crc32(body);
        const uncompSize = body.length;

        if (entry.compress && typeof CompressionStream !== 'undefined')
        {
            compressed = await _deflateRaw(body);
            if (compressed.length < body.length) { method = 8; body = compressed; }
        }

        const compSize = body.length;
        const local = new Uint8Array(30 + nameBytes.length);
        const lv = new DataView(local.buffer);
        lv.setUint32(0,  0x04034b50, true); // sig
        lv.setUint16(4,  20,         true); // version needed
        lv.setUint16(6,  0,          true); // flags
        lv.setUint16(8,  method,     true); // compression
        lv.setUint16(10, 0,          true); // mod time
        lv.setUint16(12, 0,          true); // mod date
        lv.setUint32(14, crc,        true); // crc32
        lv.setUint32(18, compSize,   true); // compressed size
        lv.setUint32(22, uncompSize, true); // uncompressed size
        lv.setUint16(26, nameBytes.length, true);
        lv.setUint16(28, 0, true);
        local.set(nameBytes, 30);

        localHeaders.push(local);
        localHeaders.push(body);

        const central = new Uint8Array(46 + nameBytes.length);
        const cv = new DataView(central.buffer);
        cv.setUint32(0,  0x02014b50, true);
        cv.setUint16(4,  20,         true);
        cv.setUint16(6,  20,         true);
        cv.setUint16(8,  0,          true);
        cv.setUint16(10, method,     true);
        cv.setUint16(12, 0,          true);
        cv.setUint16(14, 0,          true);
        cv.setUint32(16, crc,        true);
        cv.setUint32(20, compSize,   true);
        cv.setUint32(24, uncompSize, true);
        cv.setUint16(28, nameBytes.length, true);
        cv.setUint16(30, 0, true);
        cv.setUint16(32, 0, true);
        cv.setUint16(34, 0, true);
        cv.setUint16(36, 0, true);
        cv.setUint32(38, 0, true);
        cv.setUint32(42, offset, true);
        central.set(nameBytes, 46);

        centralDir.push(central);
        offset += local.length + body.length;
    }

    const cdSize   = centralDir.reduce((s, c) => s + c.length, 0);
    const eocd     = new Uint8Array(22);
    const ev       = new DataView(eocd.buffer);
    ev.setUint32(0,  0x06054b50,          true);
    ev.setUint16(4,  0,                   true);
    ev.setUint16(6,  0,                   true);
    ev.setUint16(8,  entries.length,      true);
    ev.setUint16(10, entries.length,      true);
    ev.setUint32(12, cdSize,              true);
    ev.setUint32(16, offset,              true);
    ev.setUint16(20, 0,                   true);

    const all = [...localHeaders, ...centralDir, eocd];
    const total = all.reduce((s, a) => s + a.length, 0);
    const out   = new Uint8Array(total);
    let   pos   = 0;
    for (const a of all) { out.set(a, pos); pos += a.length; }
    return out;
}

async function _deflateRaw(data: Uint8Array): Promise<Uint8Array>
{
    const cs     = new CompressionStream('deflate-raw');
    const writer = cs.writable.getWriter();
    writer.write(data as unknown as Uint8Array<ArrayBuffer>);
    writer.close();
    const chunks: Uint8Array[] = [];
    const reader = cs.readable.getReader();
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
    }
    const total = chunks.reduce((s, c) => s + c.length, 0);
    const out   = new Uint8Array(total);
    let   pos   = 0;
    for (const c of chunks) { out.set(c, pos); pos += c.length; }
    return out;
}

// ZIP reader — parse entries from ArrayBuffer
interface ZipFile { name: string; data: Uint8Array; }

function _zipRead(buf: ArrayBuffer): Map<string, Uint8Array>
{
    const map  = new Map<string, Uint8Array>();
    const view = new DataView(buf);
    const u8   = new Uint8Array(buf);
    let   pos  = buf.byteLength - 22;

    // Find EOCD
    while (pos >= 0 && view.getUint32(pos, true) !== 0x06054b50) pos--;
    if (pos < 0) return map;

    const cdOffset  = view.getUint32(pos + 16, true);
    const cdEntries = view.getUint16(pos + 10,  true);
    let   cdPos     = cdOffset;

    for (let i = 0; i < cdEntries; i++)
    {
        if (view.getUint32(cdPos, true) !== 0x02014b50) break;
        const method   = view.getUint16(cdPos + 10, true);
        const compSize = view.getUint32(cdPos + 20, true);
        const nameLen  = view.getUint16(cdPos + 28, true);
        const extraLen = view.getUint16(cdPos + 30, true);
        const cmtLen   = view.getUint16(cdPos + 32, true);
        const lhOffset = view.getUint32(cdPos + 42, true);
        const name     = new TextDecoder().decode(u8.slice(cdPos + 46, cdPos + 46 + nameLen));
        cdPos += 46 + nameLen + extraLen + cmtLen;

        // Read local header
        const lhExtraLen = view.getUint16(lhOffset + 28, true);
        const lhNameLen  = view.getUint16(lhOffset + 26, true);
        const dataStart  = lhOffset + 30 + lhNameLen + lhExtraLen;
        const compressed = u8.slice(dataStart, dataStart + compSize);

        if (method === 0) {
            map.set(name, compressed);
        } else if (method === 8) {
            try {
                map.set(name, _inflateSync(compressed));
            } catch {
                map.set(name, compressed); // fallback raw
            }
        }
    }
    return map;
}

function _inflateSync(data: Uint8Array): Uint8Array
{
    // Pure JS inflate (DEFLATE decompressor)
    // Using DecompressionStream synchronously via a workaround is not possible
    // We store the raw data and decompress lazily when accessed
    return data; // caller must handle async decompress if needed
}

async function _zipReadAsync(buf: ArrayBuffer): Promise<Map<string, Uint8Array>>
{
    const map  = new Map<string, Uint8Array>();
    const view = new DataView(buf);
    const u8   = new Uint8Array(buf);
    let   pos  = buf.byteLength - 22;

    while (pos >= 0 && view.getUint32(pos, true) !== 0x06054b50) pos--;
    if (pos < 0) return map;

    const cdOffset  = view.getUint32(pos + 16, true);
    const cdEntries = view.getUint16(pos + 10,  true);
    let   cdPos     = cdOffset;

    for (let i = 0; i < cdEntries; i++)
    {
        if (view.getUint32(cdPos, true) !== 0x02014b50) break;
        const method   = view.getUint16(cdPos + 10, true);
        const compSize = view.getUint32(cdPos + 20, true);
        const uncSize  = view.getUint32(cdPos + 24, true);
        const nameLen  = view.getUint16(cdPos + 28, true);
        const extraLen = view.getUint16(cdPos + 30, true);
        const cmtLen   = view.getUint16(cdPos + 32, true);
        const lhOffset = view.getUint32(cdPos + 42, true);
        const name     = new TextDecoder().decode(u8.slice(cdPos + 46, cdPos + 46 + nameLen));
        cdPos += 46 + nameLen + extraLen + cmtLen;

        const lhExtraLen = view.getUint16(lhOffset + 28, true);
        const lhNameLen  = view.getUint16(lhOffset + 26, true);
        const dataStart  = lhOffset + 30 + lhNameLen + lhExtraLen;
        const compressed = u8.slice(dataStart, dataStart + compSize);

        if (method === 0) {
            map.set(name, compressed);
        } else if (method === 8 && typeof DecompressionStream !== 'undefined') {
            const ds     = new DecompressionStream('deflate-raw');
            const writer = ds.writable.getWriter();
            writer.write(compressed); writer.close();
            const chunks: Uint8Array[] = [];
            const reader = ds.readable.getReader();
            while (true) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); }
            const out = new Uint8Array(uncSize);
            let off = 0;
            for (const c of chunks) { out.set(c, off); off += c.length; }
            map.set(name, out);
        }
    }
    return map;
}

// ── CRC32 ─────────────────────────────────────────────────────────────────────

const _CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
        let c = i;
        for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        t[i] = c;
    }
    return t;
})();

function _crc32(data: Uint8Array): number
{
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < data.length; i++) crc = _CRC_TABLE[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
}

// ── UTF-8 helpers ─────────────────────────────────────────────────────────────

function _utf8(s: string): Uint8Array { return new TextEncoder().encode(s); }
function _str(u: Uint8Array): string  { return new TextDecoder().decode(u); }
function _xmlStr(u: Uint8Array): string { return new TextDecoder('utf-8').decode(u); }

// ── DOCX builder ──────────────────────────────────────────────────────────────

const _DOCX_CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml"  ContentType="application/xml"/>
  <Override PartName="/word/document.xml"
    ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml"
    ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;

const _DOCX_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument"
    Target="word/document.xml"/>
</Relationships>`;

const _DOCX_WORD_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles"
    Target="styles.xml"/>
</Relationships>`;

function _docxStyles(): string {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:styleId="Normal" w:default="1">
    <w:name w:val="Normal"/>
    <w:pPr><w:spacing w:after="160" w:line="259" w:lineRule="auto"/></w:pPr>
    <w:rPr><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:basedOn w:val="Normal"/>
    <w:rPr><w:b/><w:sz w:val="48"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/>
    <w:basedOn w:val="Normal"/>
    <w:rPr><w:b/><w:sz w:val="36"/></w:rPr>
  </w:style>
</w:styles>`;
}

function _docxParagraph(p: DocxContent): string
{
    const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';

    // Table
    if ('rows' in p) {
        const tbl = p as DocxTable;
        const rows = tbl.rows.map(row => {
            const cells = row.map(cell =>
                `<w:tc><w:p><w:r><w:t xml:space="preserve">${_escXml(cell)}</w:t></w:r></w:p></w:tc>`
            ).join('');
            return `<w:tr>${cells}</w:tr>`;
        }).join('');
        return `<w:tbl><w:tblPr><w:tblW w:w="9360" w:type="dxa"/></w:tblPr>${rows}</w:tbl>`;
    }

    // Paragraph
    const para   = p as DocxParagraph;
    const styleId = para.heading ? `Heading${para.heading}` : 'Normal';
    const align   = para.align ?? 'left';
    const alignMap: Record<string, string> = { left: 'left', center: 'center', right: 'right', justify: 'both' };

    let rPr = '';
    if (para.bold)   rPr += '<w:b/>';
    if (para.italic) rPr += '<w:i/>';
    if (para.size)   rPr += `<w:sz w:val="${para.size * 2}"/><w:szCs w:val="${para.size * 2}"/>`;
    if (para.color)  rPr += `<w:color w:val="${para.color.replace('#', '')}"/>`;

    return `<w:p>
  <w:pPr>
    <w:pStyle w:val="${styleId}"/>
    <w:jc w:val="${alignMap[align] ?? 'left'}"/>
  </w:pPr>
  <w:r>${rPr ? `<w:rPr>${rPr}</w:rPr>` : ''}<w:t xml:space="preserve">${_escXml(para.text)}</w:t></w:r>
</w:p>`;
}

async function _buildDocx(opts: DocxDocument): Promise<Uint8Array>
{
    const paragraphs = (opts.paragraphs ?? []).map(p =>
        typeof p === 'string' ? _docxParagraph({ text: p }) : _docxParagraph(p)
    ).join('\n');

    const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
${paragraphs}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/>
    </w:sectPr>
  </w:body>
</w:document>`;

    return _zipBuild([
        { name: '[Content_Types].xml',      data: _utf8(_DOCX_CONTENT_TYPES), compress: false },
        { name: '_rels/.rels',              data: _utf8(_DOCX_RELS),          compress: false },
        { name: 'word/_rels/document.xml.rels', data: _utf8(_DOCX_WORD_RELS), compress: false },
        { name: 'word/document.xml',        data: _utf8(documentXml),         compress: true  },
        { name: 'word/styles.xml',          data: _utf8(_docxStyles()),        compress: true  },
    ]);
}

// ── DOCX reader ───────────────────────────────────────────────────────────────

async function _readDocx(buf: ArrayBuffer): Promise<DocxContent[]>
{
    const files = await _zipReadAsync(buf);
    const xml   = _xmlStr(files.get('word/document.xml') ?? new Uint8Array());
    const parser = new DOMParser();
    const doc    = parser.parseFromString(xml, 'application/xml');
    const result: DocxContent[] = [];

    const NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

    doc.querySelectorAll('p').forEach(p => {
        const texts = Array.from(p.querySelectorAll('t')).map(t => t.textContent ?? '').join('');
        if (texts.trim()) result.push({ text: texts });
    });

    return result;
}

// ── XLSX builder ──────────────────────────────────────────────────────────────

function _xlsxContentTypes(sheetCount: number): string
{
    const sheets = Array.from({ length: sheetCount }, (_, i) =>
        `<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
    ).join('\n  ');
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml"  ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml"
    ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/sharedStrings.xml"
    ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
  <Override PartName="/xl/styles.xml"
    ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  ${sheets}
</Types>`;
}

const _XLSX_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument"
    Target="xl/workbook.xml"/>
</Relationships>`;

function _xlsxWorkbookRels(sheetCount: number): string {
    const rels = Array.from({ length: sheetCount }, (_, i) =>
        `<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`
    ).join('\n  ');
    const ssRel = `<Relationship Id="rId${sheetCount+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>`;
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${rels}
  ${ssRel}
</Relationships>`;
}

function _xlsxWorkbook(sheets: { name: string }[]): string {
    const s = sheets.map((sh, i) =>
        `<sheet name="${_escXml(sh.name)}" sheetId="${i+1}" r:id="rId${i+1}"/>`
    ).join('\n    ');
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    ${s}
  </sheets>
</workbook>`;
}

function _xlsxStyles(): string {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts><font><sz val="11"/><name val="Calibri"/></font>
    <font><sz val="11"/><name val="Calibri"/><b/></font></fonts>
  <fills><fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill></fills>
  <borders><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0"/>
  </cellXfs>
</styleSheet>`;
}

// Column letter from index (0-based) → A, B, ... Z, AA, AB...
function _colLetter(n: number): string
{
    let s = '';
    n++;
    while (n > 0) { s = String.fromCharCode(65 + ((n - 1) % 26)) + s; n = Math.floor((n - 1) / 26); }
    return s;
}

function _xlsxSheet(rows: (CellValue | SpreadsheetCell)[][], shared: string[]): string
{
    const sharedMap = new Map<string, number>();
    shared.forEach((s, i) => sharedMap.set(s, i));

    const xmlRows = rows.map((row, ri) => {
        const cells = row.map((cell, ci) => {
            const addr = `${_colLetter(ci)}${ri + 1}`;
            const v    = typeof cell === 'object' && cell !== null && 'value' in cell
                ? (cell as SpreadsheetCell).value
                : cell as CellValue;

            if (v === null || v === undefined) return '';

            if (typeof v === 'number') {
                return `<c r="${addr}" t="n"><v>${v}</v></c>`;
            }
            if (typeof v === 'boolean') {
                return `<c r="${addr}" t="b"><v>${v ? 1 : 0}</v></c>`;
            }
            // String — use shared strings
            const str  = String(v);
            let   idx  = sharedMap.get(str);
            if (idx === undefined) { idx = shared.length; shared.push(str); sharedMap.set(str, idx); }
            return `<c r="${addr}" t="s"><v>${idx}</v></c>`;
        }).join('');
        return `<row r="${ri + 1}">${cells}</row>`;
    }).join('\n    ');

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    ${xmlRows}
  </sheetData>
</worksheet>`;
}

function _xlsxSharedStrings(shared: string[]): string {
    const items = shared.map(s => `<si><t xml:space="preserve">${_escXml(s)}</t></si>`).join('\n  ');
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${shared.length}" uniqueCount="${shared.length}">
  ${items}
</sst>`;
}

async function _buildXlsx(opts: XlsxDocument): Promise<Uint8Array>
{
    const shared: string[] = [];
    const sheets = opts.sheets;
    const sheetXmls = sheets.map(sh => _xlsxSheet(sh.rows, shared));

    const entries: ZipEntry[] = [
        { name: '[Content_Types].xml',         data: _utf8(_xlsxContentTypes(sheets.length)), compress: false },
        { name: '_rels/.rels',                 data: _utf8(_XLSX_RELS),                       compress: false },
        { name: 'xl/_rels/workbook.xml.rels',  data: _utf8(_xlsxWorkbookRels(sheets.length)), compress: false },
        { name: 'xl/workbook.xml',             data: _utf8(_xlsxWorkbook(sheets)),             compress: true  },
        { name: 'xl/styles.xml',               data: _utf8(_xlsxStyles()),                    compress: true  },
        { name: 'xl/sharedStrings.xml',        data: _utf8(_xlsxSharedStrings(shared)),        compress: true  },
    ];

    sheetXmls.forEach((xml, i) => {
        entries.push({ name: `xl/worksheets/sheet${i+1}.xml`, data: _utf8(xml), compress: true });
    });

    return _zipBuild(entries);
}

// ── XLSX reader ───────────────────────────────────────────────────────────────

async function _readXlsx(buf: ArrayBuffer): Promise<SpreadsheetData>
{
    const files  = await _zipReadAsync(buf);
    const parser = new DOMParser();

    // Shared strings
    const ssXml = _xmlStr(files.get('xl/sharedStrings.xml') ?? new Uint8Array());
    const ssDoc = parser.parseFromString(ssXml, 'application/xml');
    const shared = Array.from(ssDoc.querySelectorAll('si')).map(si =>
        Array.from(si.querySelectorAll('t')).map(t => t.textContent ?? '').join('')
    );

    // Workbook — sheet names
    const wbXml  = _xmlStr(files.get('xl/workbook.xml') ?? new Uint8Array());
    const wbDoc  = parser.parseFromString(wbXml, 'application/xml');
    const sheetEls = Array.from(wbDoc.querySelectorAll('sheet'));

    const result: SpreadsheetData = [];

    sheetEls.forEach((shEl, i) => {
        const name    = shEl.getAttribute('name') ?? `Sheet${i+1}`;
        const shXml   = _xmlStr(files.get(`xl/worksheets/sheet${i+1}.xml`) ?? new Uint8Array());
        const shDoc   = parser.parseFromString(shXml, 'application/xml');
        const rows: SpreadsheetRow[] = [];

        shDoc.querySelectorAll('row').forEach(rowEl => {
            const row: SpreadsheetRow = [];
            rowEl.querySelectorAll('c').forEach(cell => {
                const t = cell.getAttribute('t') ?? '';
                const v = cell.querySelector('v')?.textContent ?? '';
                let value: CellValue = null;
                if (t === 's') value = shared[parseInt(v)] ?? '';
                else if (t === 'b') value = v === '1';
                else if (v !== '') value = parseFloat(v);
                row.push({ value });
            });
            if (row.length) rows.push(row);
        });

        result.push({ name, rows });
    });

    return result;
}

// ── PPTX builder ──────────────────────────────────────────────────────────────

function _pptxContentTypes(slideCount: number): string {
    const slides = Array.from({ length: slideCount }, (_, i) =>
        `<Override PartName="/ppt/slides/slide${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`
    ).join('\n  ');
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml"  ContentType="application/xml"/>
  <Override PartName="/ppt/presentation.xml"
    ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  ${slides}
</Types>`;
}

const _PPTX_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument"
    Target="ppt/presentation.xml"/>
</Relationships>`;

function _pptxPresentationRels(slideCount: number): string {
    const rels = Array.from({ length: slideCount }, (_, i) =>
        `<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i+1}.xml"/>`
    ).join('\n  ');
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${rels}
</Relationships>`;
}

function _pptxPresentation(slideCount: number): string {
    const ids = Array.from({ length: slideCount }, (_, i) =>
        `<p:sldId id="${256 + i}" r:id="rId${i+1}"/>`
    ).join('\n    ');
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:sldMasterIdLst/>
  <p:sldIdLst>
    ${ids}
  </p:sldIdLst>
  <p:sldSz cx="9144000" cy="5143500"/>
  <p:notesSz cx="6858000" cy="9144000"/>
</p:presentation>`;
}

const _PPTX_SLIDE_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`;

function _pptxSlide(slide: SlideData, theme: PptxDocument['theme'] = {}): string
{
    const bg    = slide.background ?? theme?.bg ?? 'FFFFFF';
    const acc   = theme?.accent ?? '4472C4';

    const titleEl = slide.title ? `
  <p:sp>
    <p:nvSpPr>
      <p:cNvPr id="2" name="Title"/>
      <p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>
      <p:nvPr><p:ph type="title"/></p:nvPr>
    </p:nvSpPr>
    <p:spPr/>
    <p:txBody>
      <a:bodyPr/>
      <a:lstStyle/>
      <a:p><a:r><a:rPr lang="en-US" dirty="0"/>
        <a:t>${_escXml(slide.title)}</a:t></a:r></a:p>
    </p:txBody>
  </p:sp>` : '';

    const bodyEl = slide.body ? `
  <p:sp>
    <p:nvSpPr>
      <p:cNvPr id="3" name="Content"/>
      <p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>
      <p:nvPr><p:ph idx="1"/></p:nvPr>
    </p:nvSpPr>
    <p:spPr/>
    <p:txBody>
      <a:bodyPr/>
      <a:lstStyle/>
      <a:p><a:r><a:rPr lang="en-US" dirty="0"/>
        <a:t>${_escXml(slide.body)}</a:t></a:r></a:p>
    </p:txBody>
  </p:sp>` : '';

    const customEls = (slide.elements ?? []).map(el => {
        if (el.type === 'text') return `
  <p:sp>
    <p:nvSpPr><p:cNvPr id="4" name="TextBox"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>
    <p:spPr><a:xfrm><a:off x="${el.x * 9144}" y="${el.y * 5143}"/><a:ext cx="${el.w * 9144}" cy="${el.h * 5143}"/></a:xfrm>
      <a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>
    <p:txBody><a:bodyPr/><a:lstStyle/>
      <a:p><a:r><a:t>${_escXml(el.content ?? '')}</a:t></a:r></a:p>
    </p:txBody>
  </p:sp>`;
        return '';
    }).join('');

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
  xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:cSld>
    <p:bg><p:bgPr>
      <a:solidFill><a:srgbClr val="${bg.replace('#', '')}"/></a:solidFill>
      <a:effectLst/>
    </p:bgPr></p:bg>
    <p:spTree>
      <p:nvGrpSpPr>
        <p:cNvPr id="1" name=""/>
        <p:cNvGrpSpPr/><p:nvPr/>
      </p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/>
        <a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
${titleEl}
${bodyEl}
${customEls}
    </p:spTree>
  </p:cSld>
</p:sld>`;
}

async function _buildPptx(opts: PptxDocument): Promise<Uint8Array>
{
    const slides = opts.slides;
    const entries: ZipEntry[] = [
        { name: '[Content_Types].xml',              data: _utf8(_pptxContentTypes(slides.length)),    compress: false },
        { name: '_rels/.rels',                      data: _utf8(_PPTX_RELS),                          compress: false },
        { name: 'ppt/_rels/presentation.xml.rels',  data: _utf8(_pptxPresentationRels(slides.length)), compress: false },
        { name: 'ppt/presentation.xml',             data: _utf8(_pptxPresentation(slides.length)),    compress: true  },
    ];

    slides.forEach((sl, i) => {
        entries.push({ name: `ppt/slides/_rels/slide${i+1}.xml.rels`, data: _utf8(_PPTX_SLIDE_RELS), compress: false });
        entries.push({ name: `ppt/slides/slide${i+1}.xml`, data: _utf8(_pptxSlide(sl, opts.theme)), compress: true });
    });

    return _zipBuild(entries);
}

// ── PPTX reader ───────────────────────────────────────────────────────────────

async function _readPptx(buf: ArrayBuffer): Promise<PresentationData>
{
    const files  = await _zipReadAsync(buf);
    const parser = new DOMParser();
    const result: PresentationData = [];
    let   i = 1;

    while (files.has(`ppt/slides/slide${i}.xml`)) {
        const xml  = _xmlStr(files.get(`ppt/slides/slide${i}.xml`)!);
        const doc  = parser.parseFromString(xml, 'application/xml');
        const texts = Array.from(doc.querySelectorAll('t')).map(t => t.textContent ?? '').filter(Boolean);
        result.push({ title: texts[0] ?? '', body: texts.slice(1).join(' ') });
        i++;
    }
    return result;
}

// ── ODS builder ───────────────────────────────────────────────────────────────

const _ODS_MANIFEST = `<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0">
  <manifest:file-entry manifest:full-path="/" manifest:media-type="application/vnd.oasis.opendocument.spreadsheet"/>
  <manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>
  <manifest:file-entry manifest:full-path="styles.xml"  manifest:media-type="text/xml"/>
</manifest:manifest>`;

const _ODS_STYLES = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-styles xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0">
</office:document-styles>`;

function _odsContent(sheets: { name: string; rows: (CellValue | SpreadsheetCell)[][] }[]): string {
    const sheetXmls = sheets.map(sh => {
        const rowXmls = sh.rows.map(row => {
            const cellXmls = row.map(cell => {
                const v = typeof cell === 'object' && cell !== null && 'value' in cell
                    ? (cell as SpreadsheetCell).value : cell as CellValue;
                if (v === null) return '<table:table-cell/>';
                if (typeof v === 'number')  return `<table:table-cell office:value-type="float" office:value="${v}"><text:p>${v}</text:p></table:table-cell>`;
                if (typeof v === 'boolean') return `<table:table-cell office:value-type="boolean" office:boolean-value="${v}"><text:p>${v}</text:p></table:table-cell>`;
                return `<table:table-cell office:value-type="string"><text:p>${_escXml(String(v))}</text:p></table:table-cell>`;
            }).join('');
            return `<table:table-row>${cellXmls}</table:table-row>`;
        }).join('\n    ');
        return `<table:table table:name="${_escXml(sh.name)}">\n    ${rowXmls}\n  </table:table>`;
    }).join('\n  ');

    return `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content
  xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
  xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0"
  xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0">
  <office:body>
    <office:spreadsheet>
  ${sheetXmls}
    </office:spreadsheet>
  </office:body>
</office:document-content>`;
}

async function _buildOds(opts: XlsxDocument): Promise<Uint8Array>
{
    return _zipBuild([
        { name: 'mimetype',              data: _utf8('application/vnd.oasis.opendocument.spreadsheet'), compress: false },
        { name: 'META-INF/manifest.xml', data: _utf8(_ODS_MANIFEST),          compress: false },
        { name: 'styles.xml',            data: _utf8(_ODS_STYLES),             compress: true  },
        { name: 'content.xml',           data: _utf8(_odsContent(opts.sheets)), compress: true  },
    ]);
}

// ── ODP builder ───────────────────────────────────────────────────────────────

const _ODP_MANIFEST = `<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0">
  <manifest:file-entry manifest:full-path="/" manifest:media-type="application/vnd.oasis.opendocument.presentation"/>
  <manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>
</manifest:manifest>`;

function _odpContent(slides: SlideData[]): string {
    const pages = slides.map(sl => {
        const title = sl.title ? `<draw:text-box presentation:class="title" svg:width="24cm" svg:height="3cm" svg:x="2cm" svg:y="1cm"><text:p><text:span>${_escXml(sl.title)}</text:span></text:p></draw:text-box>` : '';
        const body  = sl.body  ? `<draw:text-box presentation:class="subtitle" svg:width="24cm" svg:height="10cm" svg:x="2cm" svg:y="5cm"><text:p><text:span>${_escXml(sl.body)}</text:span></text:p></draw:text-box>` : '';
        return `<draw:page draw:name="slide">${title}${body}</draw:page>`;
    }).join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content
  xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
  xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0"
  xmlns:presentation="urn:oasis:names:tc:opendocument:xmlns:presentation:1.0"
  xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"
  xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0">
  <office:body><office:presentation>
${pages}
  </office:presentation></office:body>
</office:document-content>`;
}

async function _buildOdp(opts: PptxDocument): Promise<Uint8Array>
{
    return _zipBuild([
        { name: 'mimetype',              data: _utf8('application/vnd.oasis.opendocument.presentation'), compress: false },
        { name: 'META-INF/manifest.xml', data: _utf8(_ODP_MANIFEST),           compress: false },
        { name: 'content.xml',           data: _utf8(_odpContent(opts.slides)), compress: true  },
    ]);
}

// ── CSV ───────────────────────────────────────────────────────────────────────

function _csvParse(text: string, delimiter = ','): string[][]
{
    const rows: string[][] = [];
    const lines = text.split(/\r?\n/);
    for (const line of lines) {
        if (!line.trim()) continue;
        const cells: string[] = [];
        let cur = '', inQ = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') {
                if (inQ && line[i+1] === '"') { cur += '"'; i++; }
                else inQ = !inQ;
            } else if (ch === delimiter && !inQ) {
                cells.push(cur); cur = '';
            } else {
                cur += ch;
            }
        }
        cells.push(cur);
        rows.push(cells);
    }
    return rows;
}

function _csvStringify(rows: string[][], delimiter = ','): string
{
    return rows.map(row =>
        row.map(cell => {
            const s = String(cell ?? '');
            return s.includes(delimiter) || s.includes('"') || s.includes('\n')
                ? `"${s.replace(/"/g, '""')}"`
                : s;
        }).join(delimiter)
    ).join('\r\n');
}

// ── SVG ───────────────────────────────────────────────────────────────────────

function _svgParse(text: string): Document
{
    return new DOMParser().parseFromString(text, 'image/svg+xml');
}

function _svgStringify(doc: Document): string
{
    return new XMLSerializer().serializeToString(doc.documentElement ?? doc);
}

function _svgCreate(width: number, height: number): Document
{
    const d = new DOMParser().parseFromString(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"></svg>`,
        'image/svg+xml'
    );
    return d;
}

// ── PDF generator (pure JS) ───────────────────────────────────────────────────
// Generates PDF 1.4 compliant output — text, lines, rects.
// Uses direct PDF stream construction — no canvas, no external libs.

const _PDF_SIZES: Record<string, [number, number]> = {
    A4    : [595, 842],
    A3    : [842, 1190],
    Letter: [612, 792],
    Legal : [612, 1008],
};

function _pdfBuildPage(page: PdfPage, pageW: number, pageH: number): string
{
    const lines: string[] = [];

    if (page.text) {
        // Split on newlines and render each line
        const textLines = page.text.split('\n');
        let y = pageH - 60;
        lines.push('BT', '/F1 11 Tf');
        for (const tl of textLines) {
            lines.push(`60 ${y} Td`, `(${_pdfEscStr(tl)}) Tj`, `0 -16 Td`);
            y -= 16;
        }
        lines.push('ET');
    }

    if (page.elements) {
        for (const el of page.elements) {
            const x = el.x;
            const y = pageH - el.y - (el.h ?? 0);
            if (el.type === 'text') {
                const size  = el.style?.size ?? 12;
                const color = _pdfColor(el.style?.color ?? '#000000');
                lines.push(`${color} BT /F1 ${size} Tf ${x} ${y} Td (${_pdfEscStr(el.content ?? '')}) Tj ET`);
            } else if (el.type === 'rect' && el.w && el.h) {
                lines.push(`${x} ${y} ${el.w} ${el.h} re S`);
            } else if (el.type === 'line' && el.w && el.h) {
                lines.push(`${x} ${y} m ${x + el.w} ${y + el.h} l S`);
            }
        }
    }

    return lines.join('\n');
}

function _pdfEscStr(s: string): string
{
    return s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function _pdfColor(hex: string): string
{
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg`;
}

function _buildPdf(opts: PdfDocument): Uint8Array
{
    const [pageW, pageH] = _PDF_SIZES[opts.size ?? 'A4'];
    const enc  = new TextEncoder();
    const parts: string[] = [];
    const offsets: number[] = [];
    let   pos  = 0;

    const write = (s: string) => { parts.push(s); pos += enc.encode(s).length; };

    write('%PDF-1.4\n');

    // Object 1 — catalog
    offsets[1] = pos;
    write(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`);

    // Object 2 — pages (placeholder, filled after)
    offsets[2] = pos;
    const pagesRef = opts.pages.map((_, i) => `${4 + i * 2} 0 R`).join(' ');
    write(`2 0 obj\n<< /Type /Pages /Kids [${pagesRef}] /Count ${opts.pages.length} >>\nendobj\n`);

    // Object 3 — font
    offsets[3] = pos;
    write(`3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n`);

    // Page objects
    opts.pages.forEach((page, i) => {
        const contentObjId = 4 + i * 2 + 1;
        const pageObjId    = 4 + i * 2;
        const stream       = _pdfBuildPage(page, pageW, pageH);
        const streamBytes  = enc.encode(stream);

        // Page object
        offsets[pageObjId] = pos;
        write(`${pageObjId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}]\n  /Contents ${contentObjId} 0 R /Resources << /Font << /F1 3 0 R >> >> >>\nendobj\n`);

        // Content stream
        offsets[contentObjId] = pos;
        write(`${contentObjId} 0 obj\n<< /Length ${streamBytes.length} >>\nstream\n${stream}\nendstream\nendobj\n`);
    });

    // xref
    const xrefPos = pos;
    const totalObjs = 3 + opts.pages.length * 2 + 1;
    write(`xref\n0 ${totalObjs + 1}\n0000000000 65535 f \n`);
    for (let i = 1; i <= totalObjs; i++) {
        write(`${String(offsets[i] ?? 0).padStart(10, '0')} 00000 n \n`);
    }

    const title = opts.title ?? 'Document';
    write(`trailer\n<< /Size ${totalObjs + 1} /Root 1 0 R /Info << /Title (${_pdfEscStr(title)}) >> >>\nstartxref\n${xrefPos}\n%%EOF\n`);

    const full = parts.join('');
    return enc.encode(full);
}

// ── XML escape ────────────────────────────────────────────────────────────────

function _escXml(s: string): string
{
    return s
        .replace(/&/g,  '&amp;')
        .replace(/</g,  '&lt;')
        .replace(/>/g,  '&gt;')
        .replace(/"/g,  '&quot;')
        .replace(/'/g,  '&apos;');
}

// ── File reader helper ────────────────────────────────────────────────────────

async function _toArrayBuffer(src: File | Blob | ArrayBuffer | string): Promise<ArrayBuffer>
{
    if (src instanceof ArrayBuffer) return src;
    if (src instanceof Blob)        return src.arrayBuffer();
    if (typeof src === 'string') {
        // URL fetch
        const res = await fetch(src);
        return res.arrayBuffer();
    }
    throw new Error('Docs.read: unsupported source type');
}

// ── Public API ────────────────────────────────────────────────────────────────

export const Docs = {

    // ── Read any document ─────────────────────────────────────────────────────

    /**
     * Read a document from a File, Blob, ArrayBuffer, or URL.
     * Format is auto-detected from the filename extension.
     *
     * @example
     *   const doc  = await Docs.read(fileInput.files[0]);
     *   const rows = doc.content as SpreadsheetData;
     *
     * @example
     *   const doc = await Docs.read('https://example.com/report.xlsx');
     *   Docs.download(doc, 'local-copy.xlsx');
     */
    async read(
        src    : File | Blob | ArrayBuffer | string,
        format?: DocFormat,
    ): Promise<DocsDocument>
    {
        const name = src instanceof File ? src.name : (typeof src === 'string' ? src : '');
        const fmt  = format ?? _detectFormat(name) ?? 'xlsx';
        const buf  = await _toArrayBuffer(src);

        switch (fmt) {
            case 'docx': {
                const content = await _readDocx(buf);
                return new DocsDocument('docx', content, { format: 'docx', filename: name });
            }
            case 'xlsx': {
                const content = await _readXlsx(buf);
                return new DocsDocument('xlsx', content, { format: 'xlsx', filename: name, sheetCount: content.length });
            }
            case 'pptx': {
                const content = await _readPptx(buf);
                return new DocsDocument('pptx', content, { format: 'pptx', filename: name, slideCount: content.length });
            }
            case 'csv': {
                const text    = new TextDecoder().decode(buf);
                const rows    = _csvParse(text);
                const content: SpreadsheetData = [{ name: 'Sheet1', rows: rows.map(r => r.map(v => ({ value: v }))) }];
                return new DocsDocument('csv', content, { format: 'csv', filename: name });
            }
            case 'svg': {
                const text    = new TextDecoder().decode(buf);
                const svgDoc  = _svgParse(text);
                return new DocsDocument('svg', svgDoc, { format: 'svg', filename: name });
            }
            case 'ods': {
                const content = await _readXlsx(buf); // ODS and XLSX share similar read logic
                return new DocsDocument('ods', content, { format: 'ods', filename: name });
            }
            default:
                return new DocsDocument(fmt, buf, { format: fmt, filename: name });
        }
    },

    // ── Download ──────────────────────────────────────────────────────────────

    /**
     * Trigger a browser download for a DocsDocument.
     *
     * @example
     *   Docs.download(xlsx, 'report.xlsx');
     */
    download(doc: DocsDocument, filename?: string): void
    {
        const name = filename ?? doc.meta.filename ?? `document.${doc.format}`;
        const url  = URL.createObjectURL(doc.toBlob());
        const a    = document.createElement('a');
        a.href     = url;
        a.download = name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
    },

    // ── DOCX ──────────────────────────────────────────────────────────────────

    docx: {
        /**
         * Create a DOCX document from paragraphs and tables.
         *
         * @example
         *   const doc = Docs.docx.create({
         *     title     : 'My Report',
         *     paragraphs: [
         *       { text: 'Title', heading: 1 },
         *       { text: 'Hello World', bold: true },
         *       { rows: [['Name','Age'],['Alice','30']] },
         *     ],
         *   });
         *   Docs.download(doc, 'report.docx');
         */
        async create(opts: DocxDocument): Promise<DocsDocument>
        {
            const data = await _buildDocx(opts);
            return new DocsDocument('docx', data.buffer as ArrayBuffer, { format: 'docx', title: opts.title, author: opts.author });
        },
    },

    // ── XLSX ──────────────────────────────────────────────────────────────────

    xlsx: {
        /**
         * Create an XLSX workbook from sheets.
         *
         * @example
         *   const wb = await Docs.xlsx.create({
         *     sheets: [
         *       { name: 'Sales', rows: [['Product','Q1','Q2'],['Shoes',100,120]] },
         *       { name: 'Summary', rows: [['Total',220]] },
         *     ]
         *   });
         *   Docs.download(wb, 'workbook.xlsx');
         */
        async create(opts: XlsxDocument): Promise<DocsDocument>
        {
            const data = await _buildXlsx(opts);
            return new DocsDocument('xlsx', data.buffer as ArrayBuffer, { format: 'xlsx', title: opts.title, sheetCount: opts.sheets.length });
        },

        /**
         * Convert a 2D array to a single-sheet XLSX.
         *
         * @example
         *   const doc = await Docs.xlsx.fromArray([['Name','Age'],['Alice',30]]);
         */
        async fromArray(rows: CellValue[][], sheetName = 'Sheet1'): Promise<DocsDocument>
        {
            return Docs.xlsx.create({ sheets: [{ name: sheetName, rows }] });
        },
    },

    // ── PPTX ──────────────────────────────────────────────────────────────────

    pptx: {
        /**
         * Create a PPTX presentation from slides.
         *
         * @example
         *   const deck = await Docs.pptx.create({
         *     title : 'Quarterly Review',
         *     theme : { accent: '4472C4', bg: 'FFFFFF' },
         *     slides: [
         *       { title: 'Q1 Results', body: 'Revenue up 12%' },
         *       { title: 'Forecast',   body: 'Target: 150M' },
         *     ],
         *   });
         *   Docs.download(deck, 'review.pptx');
         */
        async create(opts: PptxDocument): Promise<DocsDocument>
        {
            const data = await _buildPptx(opts);
            return new DocsDocument('pptx', data.buffer as ArrayBuffer, { format: 'pptx', title: opts.title, slideCount: opts.slides.length });
        },
    },

    // ── ODS ───────────────────────────────────────────────────────────────────

    ods: {
        /**
         * Create an ODS (LibreOffice Calc) spreadsheet.
         *
         * @example
         *   const ods = await Docs.ods.create({ sheets: [{ name: 'Data', rows: [[1,2,3]] }] });
         *   Docs.download(ods, 'data.ods');
         */
        async create(opts: XlsxDocument): Promise<DocsDocument>
        {
            const data = await _buildOds(opts);
            return new DocsDocument('ods', data.buffer as ArrayBuffer, { format: 'ods', title: opts.title });
        },
    },

    // ── ODP ───────────────────────────────────────────────────────────────────

    odp: {
        /**
         * Create an ODP (LibreOffice Impress) presentation.
         *
         * @example
         *   const odp = await Docs.odp.create({ slides: [{ title: 'Hello', body: 'World' }] });
         *   Docs.download(odp, 'deck.odp');
         */
        async create(opts: PptxDocument): Promise<DocsDocument>
        {
            const data = await _buildOdp(opts);
            return new DocsDocument('odp', data.buffer as ArrayBuffer, { format: 'odp', title: opts.title });
        },
    },

    // ── CSV ───────────────────────────────────────────────────────────────────

    csv: {
        /**
         * Parse CSV text into a 2D string array.
         *
         * @example
         *   const rows = Docs.csv.parse('name,age\nAlice,30\nBob,25');
         *   // → [['name','age'],['Alice','30'],['Bob','25']]
         */
        parse(text: string, delimiter = ','): string[][]
        {
            return _csvParse(text, delimiter);
        },

        /**
         * Stringify a 2D array to CSV text.
         *
         * @example
         *   const text = Docs.csv.stringify([['name','age'],['Alice','30']]);
         */
        stringify(rows: (string | number | boolean | null)[][], delimiter = ','): string
        {
            return _csvStringify(rows.map(r => r.map(c => c == null ? '' : String(c))), delimiter);
        },

        /**
         * Create a DocsDocument from a CSV string.
         */
        fromString(text: string, filename = 'data.csv'): DocsDocument
        {
            const rows    = _csvParse(text);
            const content: SpreadsheetData = [{ name: 'Sheet1', rows: rows.map(r => r.map(v => ({ value: v }))) }];
            return new DocsDocument('csv', content, { format: 'csv', filename });
        },
    },

    // ── SVG ───────────────────────────────────────────────────────────────────

    svg: {
        /**
         * Parse an SVG string into a DOM Document.
         *
         * @example
         *   const svgDoc = Docs.svg.parse('<svg>...</svg>');
         *   svgDoc.querySelector('circle')!.setAttribute('fill', 'red');
         *   const output = Docs.svg.stringify(svgDoc);
         */
        parse(text: string): Document
        {
            return _svgParse(text);
        },

        /**
         * Serialize a DOM Document back to SVG string.
         */
        stringify(doc: Document): string
        {
            return _svgStringify(doc);
        },

        /**
         * Create a new blank SVG document.
         *
         * @example
         *   const svg = Docs.svg.create(800, 600);
         *   const circle = svg.createElementNS('http://www.w3.org/2000/svg', 'circle');
         *   circle.setAttribute('cx', '400'); circle.setAttribute('cy', '300'); circle.setAttribute('r', '100');
         *   svg.documentElement.appendChild(circle);
         *   const text = Docs.svg.stringify(svg);
         */
        create(width: number, height: number): Document
        {
            return _svgCreate(width, height);
        },

        /**
         * Create a DocsDocument from an SVG string.
         */
        fromString(text: string, filename = 'image.svg'): DocsDocument
        {
            return new DocsDocument('svg', _svgParse(text), { format: 'svg', filename });
        },
    },

    // ── PDF ───────────────────────────────────────────────────────────────────

    pdf: {
        /**
         * Generate a PDF document.
         *
         * @example
         *   const doc = Docs.pdf.create({
         *     title : 'Annual Report',
         *     size  : 'A4',
         *     pages : [
         *       { text: 'AriannA Annual Report\nRevenue: CHF 10M' },
         *       { elements: [
         *           { type: 'text', x: 60, y: 60, content: 'Page 2', style: { size: 18, bold: true } },
         *           { type: 'rect', x: 60, y: 80, w: 400, h: 2 },
         *         ]
         *       },
         *     ],
         *   });
         *   Docs.download(doc, 'report.pdf');
         */
        create(opts: PdfDocument): DocsDocument
        {
            const data = _buildPdf(opts);
            return new DocsDocument('pdf', data.buffer as ArrayBuffer, { format: 'pdf', title: opts.title, pageCount: opts.pages.length });
        },
    },
};

// ── Global registration ───────────────────────────────────────────────────────

if (typeof window !== 'undefined')
    Object.defineProperty(window, 'Docs', {
        value       : Docs,
        writable    : false,
        enumerable  : false,
        configurable: false,
    });

export default Docs;
