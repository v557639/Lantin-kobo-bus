export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { Resvg } from '@resvg/resvg-js';
import path from 'path';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const svgUrl = `${url.origin}/api/board`;

    // 1. 抓取 SVG
    const svgRes = await fetch(svgUrl, { cache: 'no-store' });
    if (!svgRes.ok) {
      throw new Error(`Failed to fetch SVG: ${svgRes.statusText}`);
    }
    const svgText = await svgRes.text();

    // 2. 定位字體檔案絕對路徑
    const fontPath = path.join(process.cwd(), 'app', 'api', 'board', 'png', 'font.ttf');

    // 3. 用 Resvg 渲染，直接將 fontFiles 指向字體檔案
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
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('PNG error:', msg);
    return new Response(`Error: ${msg}`, { status: 500 });
  }
}
