export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import sharp from 'sharp';

// 緩存字體 Base64，避免每次請求重複下載
let fontBase64Cache = '';

async function getFontBase64() {
  if (fontBase64Cache) return fontBase64Cache;
  // 從 Google Fonts 下載輕量 woff 格式的繁體中文黑體 (子集)
  const fontUrl = 'https://fonts.gstatic.com/ea/notosanstc/v1/NotoSansTC-Bold.woff';
  const res = await fetch(fontUrl);
  const buffer = await res.arrayBuffer();
  fontBase64Cache = Buffer.from(buffer).toString('base64');
  return fontBase64Cache;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const svgUrl = `${url.origin}/api/board`;
    
    // 1. 同步抓取 SVG 與字型
    const [svgRes, fontBase64] = await Promise.all([
      fetch(svgUrl, { cache: 'no-store' }),
      getFontBase64(),
    ]);

    if (!svgRes.ok) {
      throw new Error(`Failed to fetch SVG: ${svgRes.statusText}`);
    }
    let svgText = await svgRes.text();

    // 2. 注入 @font-face 樣式進 SVG
    const fontStyle = `
      <style>
        @font-face {
          font-family: 'sans-serif';
          src: url('data:font/woff;base64,${fontBase64}') format('woff');
        }
        text {
          font-family: 'sans-serif' !important;
        }
      </style>
    `;

    // 插入到 <svg ...> 標籤後
    svgText = svgText.replace(/(<svg[^>]*>)/i, `$1${fontStyle}`);

    // 3. 用 sharp 轉成 1440x1920 PNG
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
