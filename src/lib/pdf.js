/**
 * A very small PDF writer.
 *
 * PRD 5.3.5 asks for "PDF receipt generation" on escrow transactions. A
 * receipt is a page of positioned text and a few rules — it does not need a
 * layout engine, and pulling in a 400 KB library so a customer can save a
 * page of text would be a poor trade in an app aimed at low-end Android
 * devices on slow connections.
 *
 * So this emits PDF 1.4 directly: one page, the Helvetica base-14 fonts, and
 * the drawing operators for text and lines. Roughly 150 lines against a
 * dependency that would dwarf the rest of the bundle.
 *
 * ── The one real constraint ────────────────────────────────────────────────
 * The base-14 fonts use WinAnsiEncoding, which has no rupee sign. Writing "₹"
 * would emit a wrong glyph or nothing at all, silently, on a financial
 * document. Amounts are therefore prefixed "INR" — unambiguous, and correct
 * in the encoding actually being used. Embedding a font that has ₹ would mean
 * shipping and subsetting one, which is exactly the weight this avoids.
 */

/** Points. A4 rather than Letter — the document is for an Indian audience. */
export const PAGE = { width: 595.28, height: 841.89 }

const FONTS = { regular: 'Helvetica', bold: 'Helvetica-Bold' }

/**
 * Escapes a string for a PDF literal.
 *
 * Backslash first — escaping it after the parens would double-escape the
 * backslashes this function itself introduces.
 */
function pdfString(text) {
  return String(text ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    /* WinAnsi has no glyph for these; substitute rather than emit a box. */
    .replace(/₹/g, 'INR ')
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    .replace(/[–—]/g, '-')
    /* Anything still outside WinAnsi's printable range would render as a
       wrong glyph. Dropping it is the honest failure. */
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, '')
}

/**
 * Builds a page content stream from a list of drawing instructions.
 *
 * Coordinates are given from the TOP of the page, because that is how anyone
 * laying out a document thinks; PDF's origin is bottom-left, so y is flipped
 * here once rather than at every call site.
 */
function buildContent(items) {
  const out = []

  for (const item of items) {
    const y = PAGE.height - item.y

    if (item.type === 'text') {
      const font = item.bold ? '/F2' : '/F1'
      const size = item.size ?? 10
      const gray = item.gray ?? 0
      let x = item.x

      /* Right-alignment needs a width, and Helvetica metrics are not
         available here. 0.5em per character is close enough for the numeric
         columns this is used for, where the strings are short and the space
         is generous. */
      if (item.align === 'right') {
        x = item.x - String(item.text).length * size * 0.5
      }

      out.push(
        `BT ${gray} g ${font} ${size} Tf 1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm (${pdfString(item.text)}) Tj ET`,
      )
    }

    if (item.type === 'line') {
      const gray = item.gray ?? 0.8
      out.push(
        `${gray} G ${item.width ?? 0.5} w ${item.x1.toFixed(2)} ${y.toFixed(2)} m ${item.x2.toFixed(2)} ${y.toFixed(2)} l S`,
      )
    }

    if (item.type === 'rect') {
      const gray = item.gray ?? 0.95
      out.push(
        `${gray} g ${item.x.toFixed(2)} ${(y - item.height).toFixed(2)} ${item.width.toFixed(2)} ${item.height.toFixed(2)} re f`,
      )
    }
  }

  return out.join('\n')
}

/**
 * Assembles the file.
 *
 * The xref table stores a BYTE OFFSET for every object, so the file has to be
 * built as bytes and measured as bytes. Building it as a JS string and using
 * `.length` would be wrong the moment any content is non-ASCII, and wrong in
 * a way that only shows up as "damaged file" in a reader.
 */
export function buildPdf(items, { title = 'Receipt' } = {}) {
  const content = buildContent(items)
  const encoder = new TextEncoder()

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE.width} ${PAGE.height}] ` +
      `/Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>`,
    `<< /Length ${encoder.encode(content).length} >>\nstream\n${content}\nendstream`,
    `<< /Type /Font /Subtype /Type1 /BaseFont /${FONTS.regular} /Encoding /WinAnsiEncoding >>`,
    `<< /Type /Font /Subtype /Type1 /BaseFont /${FONTS.bold} /Encoding /WinAnsiEncoding >>`,
    `<< /Title (${pdfString(title)}) /Producer (HomeBuild) >>`,
  ]

  const chunks = []
  const offsets = []
  let length = 0

  const push = (text) => {
    const bytes = encoder.encode(text)
    chunks.push(bytes)
    length += bytes.length
  }

  push('%PDF-1.4\n')
  /* A binary comment marks the file as binary for tools that sniff it. */
  chunks.push(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]))
  length += 6

  objects.forEach((body, i) => {
    offsets.push(length)
    push(`${i + 1} 0 obj\n${body}\nendobj\n`)
  })

  const xrefOffset = length
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const offset of offsets) {
    xref += `${String(offset).padStart(10, '0')} 00000 n \n`
  }
  push(xref)
  push(
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info ${objects.length} 0 R >>\n` +
      `startxref\n${xrefOffset}\n%%EOF\n`,
  )

  const file = new Uint8Array(length)
  let at = 0
  for (const chunk of chunks) {
    file.set(chunk, at)
    at += chunk.length
  }
  return file
}

/** Hands the file to the browser. */
export function downloadPdf(filename, items, options) {
  const blob = new Blob([buildPdf(items, options)], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename.endsWith('.pdf') ? filename : `${filename}.pdf`
  document.body.appendChild(link)
  link.click()
  link.remove()
  /* Revoked on the next tick — immediately would race the click in Safari. */
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
