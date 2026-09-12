export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import sharp from 'sharp';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const svgUrl = `${url.origin}/api/board`;
    
    const svgRes = await fetch(svgUrl, { cache: 'no-store' });
    const svgText = await svgRes.text();

    // 用 sharp 將 SVG 轉成 1440x1920 PNG
    const pngBuffer = await sharp(Buffer.from(svgText))
      .resize(1440, 1920)
      .png()
      .toBuffer();

    return new Response(pngBuffer, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (err: any) {
    return new Response(`Error: ${err.message}`, { status: 500 });
  }
}
