/**
 * Genera una miniatura comprimida (WebP) de una imagen en el navegador, sin tocar el original.
 * Se usa para no cargar la galería con fotos a resolución completa.
 *
 * @param {File} file - Imagen original (jpg/png/etc)
 * @param {number} maxSize - Lado máximo en px (por defecto 500)
 * @param {number} quality - Calidad WebP 0-1 (por defecto 0.75)
 * @returns {Promise<Blob|null>} Blob WebP, o null si el archivo no es imagen o falla la generación
 */
export async function generateThumbnail(file, maxSize = 500, quality = 0.75) {
    if (!file?.type?.startsWith('image/')) return null;

    try {
        // imageOrientation: 'from-image' respeta el EXIF de fotos hechas con el móvil
        const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });

        const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
        const w = Math.max(1, Math.round(bitmap.width * scale));
        const h = Math.max(1, Math.round(bitmap.height * scale));

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(bitmap, 0, 0, w, h);
        bitmap.close?.();

        const blob = await new Promise((resolve) => {
            canvas.toBlob((b) => resolve(b), 'image/webp', quality);
        });

        return blob || null;
    } catch (e) {
        console.error('Error generando thumbnail:', e);
        return null; // si falla, seguimos sin thumbnail — no debe romper la subida
    }
}
