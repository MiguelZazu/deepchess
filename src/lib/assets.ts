// User-uploaded images (background, board, square textures, pieces) stored in IndexedDB.
import { createStore, del, get, set } from 'idb-keyval';
import type { AssetSlot } from './types';
import { t } from '../i18n';

const store = createStore('deepchess-assets', 'assets');

const LIMITS: Record<string, { max: number; type: 'image/png' | 'image/jpeg' }> = {
  bg: { max: 2200, type: 'image/jpeg' },
  board: { max: 1200, type: 'image/jpeg' },
  sqLight: { max: 256, type: 'image/png' },
  sqDark: { max: 256, type: 'image/png' },
  piece: { max: 256, type: 'image/png' },
};

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(t('No se pudo leer la imagen.')));
    };
    img.src = url;
  });
}

/** Resizes the image (keeping transparency for pieces/squares) and stores it. Returns a data URL. */
export async function saveAsset(slot: AssetSlot, file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error(t('El archivo debe ser una imagen (PNG, JPG, WEBP o SVG).'));
  const lim = LIMITS[slot.startsWith('piece') ? 'piece' : slot];
  const img = await loadImage(file);
  const w = img.naturalWidth || lim.max;
  const h = img.naturalHeight || lim.max;
  const scale = Math.min(1, lim.max / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
  const url = canvas.toDataURL(lim.type, 0.88);
  await set(slot, url, store);
  return url;
}

export const getAsset = (slot: AssetSlot) => get<string>(slot, store).catch(() => undefined);
export const deleteAsset = (slot: AssetSlot) => del(slot, store).catch(() => undefined);
