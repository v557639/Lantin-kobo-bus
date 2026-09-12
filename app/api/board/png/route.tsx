export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

// 緩存讀取咗嘅字體，唔使每次 request 都讀碟
let cachedFontBase64 = '';

function getLocalFontBase64(): string {
  if (cachedFontBase64) return cachedFontBase64;
  // 直接讀取擺喺同一個資料夾嘅 font.ttf
  const fontPath = path.join(process.cwd(), 'app/api/board/png/font.ttf');
  const fontBuffer = fs.readFileSync(fontPath);
  cachedFontBase64 = fontBuffer.toString('base64');
  return cachedFontBase64;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const svgUrl = `${url.origin}/api/board`;

    // 1. 抓取 SVG 內容
    const svgRes = await fetch(svgUrl, { cache: 'no-store' });
    if (!svgRes.ok) {
      throw new Error(`Failed to fetch SVG: ${svgRes.statusText}`);
    }
    let svgText = await svgRes.text();

    // 2. 注入本地 TTF 字體樣式進 SVG
    const fontBase64 = getLocalFontBase64();
    const fontStyle = `
      <style>
        @font-face {
          font-family: 'LocalNoto';
          src: url('data:font/truetype;charset=utf-8;base64,${fontBase64}') format('truetype');
          font-weight: normal;
          font-style: normal;
        }
        text, tspan {
          font-family: 'LocalNoto', sans-serif !important;
        }
      </style>
    `;

    // 插入到 <svg ...> 標籤後
    svgText = svgText.replace(/(<svg[^>]*>)/i, `$1${fontStyle}`);

    // 3. 用 sharp 轉成 1440x1920 高清 PNG
    const pngBuffer = await sharp(Buffer.from(svgText))
      .resize(1440, 1920)
      .png()
      .toBuffer();

    return new Response(pngBuffer as any, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(`Error: ${msg}`, { status: 500 });
  }
}
