import { toPng } from 'html-to-image';

/**
 * Rasterise a DOM node to a PNG and trigger a download. Renders at 2× for a
 * crisp image and paints a solid background so the export isn't transparent.
 */
export async function downloadNodeAsPng(node: HTMLElement, filename: string) {
  const dataUrl = await toPng(node, {
    pixelRatio: 2,
    cacheBust: true,
    backgroundColor: getComputedStyle(document.body).backgroundColor || '#0b0d12',
  });
  const link = document.createElement('a');
  link.download = filename.endsWith('.png') ? filename : `${filename}.png`;
  link.href = dataUrl;
  link.click();
}
