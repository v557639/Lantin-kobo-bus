export const dynamic = 'force-dynamic';

import { Resvg } from '@resvg/resvg-js';
import { GET as getSvgResponse } from '../route';

export async function GET() {
  try {
    const svgRes = await getSvgResponse();
    const svgText = await svgRes.text();

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
        'Content-Length': pngBuffer.length.toString(),
      },
    });
  } catch (err: any) {
    console.error('PNG conversion error:', err);
    return new Response(`Failed to generate PNG: ${err.message}`, { status: 500 });
  }
}
