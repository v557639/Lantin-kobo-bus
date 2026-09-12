export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import sharp from 'sharp';

// 緩存 TTF 字體 Base64，避免每次重拉
let fontBase64Cache = '';

async function getTtfFontBase64() {
  if (fontBase64Cache) return fontBase64Cache;
  // 直接從 Google Noto 官方倉庫拉取標準 TTF 格式繁體中文字體
  const fontUrl = 'https://raw.githubusercontent.com/googlefonts/noto-cjk/main/Sans/OTF/TraditionalChinese/NotoSansCJKtc-Bold.otf';
  const res = await fetch(fontUrl);
  if (!res.ok) {
    // 備用源：如果 GitHub raw 慢，直接走 jsdelivr CDN 的標準 TTF
    const fallbackUrl = 'https://cdn.jsdelivr.net/gh/googlefonts/noto-cjk@main/Sans/OTF/TraditionalChinese/NotoSansCJKtc-Bold.otf';
    const fbRes = await fetch(fallbackUrl);
    const fbBuffer = await fbRes.arrayBuffer();
    fontBase64Cache = Buffer.from(fbBuffer).toString('base64');
    return fontBase64Cache;
  }
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
      getTtfFontBase64(),
    ]);

    if (!svgRes.ok) {
      throw new Error(`Failed to fetch SVG: ${svgRes.statusText}`);
    }
    let svgText = await svgRes.text();

    // 2. 注入 @font-face (明確標明 format 為 opentype / truetype)
    const fontStyle = `
      <style>
        @font-face {
          font-family: 'NotoSansTC';
          src: url('data:font/otf;base64,${fontBase64}') format('opentype');
        }
        text, tspan {
          font-family: 'NotoSansTC', sans-serif !important;
        }
      </style>
    `;

    // 插入到 <svg ...> 之後
    svgText = svgText.replace(/(<svg[^>]*>)/i, `$1${fontStyle}`);

    // 3. 轉成 1440x1920 PNG
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
