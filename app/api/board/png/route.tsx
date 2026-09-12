export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { Resvg, initWasm } from '@resvg/resvg-wasm';
import { GET as getSvgResponse } from '../route';

// 確保 WASM 模組只初始化一次
let wasmInitialized = false;

async function ensureWasm() {
  if (!wasmInitialized) {
    // 自動從 CDN 載入輕量 WASM 核心，Vercel 完美支援
    const wasmUrl = 'https://unpkg.com/@resvg/resvg-wasm@2.6.2/index_bg.wasm';
    const response = await fetch(wasmUrl);
    const wasmBuffer = await response.arrayBuffer();
    await initWasm(wasmBuffer);
    wasmInitialized = true;
  }
}

export async function GET() {
  try {
    await ensureWasm();

    // 1. 抓取 SVG 內容
    const svgRes = await getSvgResponse();
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
