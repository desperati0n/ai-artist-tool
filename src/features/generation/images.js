import {manager,local} from './session.js';
import {allArtists,hasExampleImage} from './selectors.js';
import {GENERATED_JPEG_QUALITY} from './config.js';

async function loadImageFlags() {
    const context = manager();
    const artists = allArtists();
    local.imageIds = new Set(artists.filter((artist) => hasExampleImage(artist)).map((artist) => String(artist.id)));
    if (!context.db?.get) { local.imageFlagsReady = true; return; }
    const missing = artists.filter((artist) => !local.imageIds.has(String(artist.id)));
    const images = await Promise.all(missing.map(async (artist) => {
      const image = await context.db.get(artist.id);
      return image ? String(artist.id) : null;
    }));
    images.filter(Boolean).forEach((id) => local.imageIds.add(id));
    local.imageFlagsReady = true;
  }

async function convertGeneratedImageToJpeg(dataUrl, quality = GENERATED_JPEG_QUALITY) {
    const response = await fetch(dataUrl);
    if (!response.ok) throw new Error(`读取生成图失败 (${response.status})`);
    const sourceBlob = await response.blob();
    if (sourceBlob.type === 'image/jpeg') return dataUrl;
    const bitmap = await createImageBitmap(sourceBlob);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext('2d', { alpha: false });
      if (!context) throw new Error('浏览器无法创建图片转换画布');
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, 0, 0);
      const jpegBlob = await new Promise((resolve, reject) => {
        canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('JPEG 转换失败')), 'image/jpeg', quality);
      });
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error || new Error('JPEG 读取失败'));
        reader.readAsDataURL(jpegBlob);
      });
    } finally {
      bitmap.close();
    }
  }

export {loadImageFlags,convertGeneratedImageToJpeg};
