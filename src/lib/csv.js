/**
 * CSV export.
 *
 * The export buttons used to raise a toast claiming a PDF had been produced.
 * Generating a real PDF needs a rendering library this app does not carry, so
 * these produce CSV instead — which is what a construction PM actually opens
 * in Excel anyway, and is honest about what it is.
 */

/**
 * Escapes one field. A value containing a comma, quote or newline must be
 * quoted, and embedded quotes doubled, or the file silently misparses.
 */
function escapeCell(value) {
  if (value == null) return ''
  const text = String(value)
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/**
 * Builds and downloads a CSV.
 *
 * @param filename  Name offered to the browser, without extension.
 * @param columns   [{ key, label }] in the order they should appear.
 * @param rows      Objects keyed by `key`, or a `format` per column.
 */
export function downloadCsv(filename, columns, rows) {
  const header = columns.map((c) => escapeCell(c.label)).join(',')

  const body = rows
    .map((row) =>
      columns
        .map((col) =>
          escapeCell(col.format ? col.format(row[col.key], row) : row[col.key]),
        )
        .join(','),
    )
    .join('\n')

  /* The BOM makes Excel read this as UTF-8, without which ₹ and Indian names
     render as mojibake — the single most likely complaint about this feature. */
  const blob = new Blob(['﻿', header, '\n', body], {
    type: 'text/csv;charset=utf-8',
  })

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(link)
  link.click()
  link.remove()
  /* Revoked on the next tick: revoking synchronously can cancel the download
     in some browsers before it starts. */
  setTimeout(() => URL.revokeObjectURL(url), 0)

  return rows.length
}
