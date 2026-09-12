export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { Resvg, initWasm } from '@resvg/resvg-wasm';

let wasmInitialized = false;

async function ensureWasm() {
  if (!wasmInitialized) {
    const wasmUrl = 'https://unpkg.com/@resvg/resvg-wasm@2.6.2/index_bg.wasm';
    const response = await fetch(wasmUrl);
    const wasmBuffer = await response.arrayBuffer();
    await initWasm(wasmBuffer);
    wasmInitialized = true;
  }
}

export async function GET(request: Request) {
  try {
    await ensureWasm();

    // 1. 動態取得當前主機網址，直接呼叫原本的 SVG API
    const url = new URL(request.url);
    const svgUrl = `${url.origin}/api/board`;
    
    const svgRes = await fetch(svgUrl, { cache: 'no-store' });
    if (!svgRes.ok) {
      throw new Error(`Failed to fetch SVG: ${svgRes.statusText}`);
    }
    const svgText = await svgRes.text();

    // 2. 轉成 1440x1920 高清 PNG
    const resvg = new Resvg(svgText, {
      fitTo: {
        mode: 'width',
        value: 1440,
      },
    });

    const pngData = resvg.render();
    const pngBuffer = pngData.asPng();

    return new Response(pngBuffer, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (err: any) {
    console.error('PNG conversion error:', err);
    return new Response(`Failed to generate PNG: ${err.message}`, { status: 500 });
  }
}
