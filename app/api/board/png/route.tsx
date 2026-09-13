export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { Resvg } from '@resvg/resvg-js';
import path from 'path';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    // 抓取 SVG 時加入隨機時間戳，防止內部快取
    const svgUrl = `${url.origin}/api/board?t=${Date.now()}`;

    const svgRes = await fetch(svgUrl, { cache: 'no-store' });
    if (!svgRes.ok) {
      throw new Error(`Failed to fetch SVG: ${svgRes.statusText}`);
    }
    const svgText = await svgRes.text();

    const fontPath = path.join(process.cwd(), 'app', 'api', 'board', 'png', 'font.ttf');

    const resvg = new Resvg(svgText, {
      fitTo: {
        mode: 'width',
        value: 1440,
      },
      font: {
        fontFiles: [fontPath],
        loadSystemFonts: false,
      },
    });

    const pngData = resvg.render();
    const pngBuffer = pngData.asPng();

    return new Response(pngBuffer as any, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('PNG error:', msg);
    return new Response(`Error: ${msg}`, { status: 500 });
  }
}
