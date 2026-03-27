/**
 * Client-side file download utility.
 * Creates a Blob from content and triggers a browser download.
 */

/**
 * Trigger a client-side file download.
 *
 * @param {string} content - File content as a string
 * @param {string} filename - Download filename (e.g., 'route.gpx')
 * @param {string} [mimeType='application/gpx+xml'] - MIME type for the Blob
 */
export function downloadFile(content, filename, mimeType = 'application/gpx+xml') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;

  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  URL.revokeObjectURL(url);
}
