export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import sharp from 'sharp';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const svgUrl = `${url.origin}/api/board`;
    
    const svgRes = await fetch(svgUrl, { cache: 'no-store' });
    if (!svgRes.ok) {
      throw new Error(`Failed to fetch SVG: ${svgRes.statusText}`);
    }
    const svgText = await svgRes.text();

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
