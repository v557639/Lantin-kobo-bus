export const dynamic = 'force-dynamic';
export const runtime = 'edge';

import { ImageResponse } from 'next/og';

export async function GET(request: Request) {
  try {
    // 1. 取得當前伺服器網址，抓取原本的 SVG
    const url = new URL(request.url);
    const svgUrl = `${url.origin}/api/board`;
    
    const svgRes = await fetch(svgUrl, { cache: 'no-store' });
    if (!svgRes.ok) {
      throw new Error(`Failed to fetch SVG: ${svgRes.statusText}`);
    }
    const svgText = await svgRes.text();

    // 2. 將 SVG 轉成 Data URI
    const svgBase64 = Buffer.from(svgText).toString('base64');
    const svgDataUri = `data:image/svg+xml;base64,${svgBase64}`;

    // 3. 用 Next.js 內建的 ImageResponse 渲染成標準 1440x1920 PNG
    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            backgroundColor: '#ffffff',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={svgDataUri}
            alt="Transit Board"
            width="1440"
            height="1920"
            style={{ width: '1440px', height: '1920px' }}
          />
        </div>
      ),
      {
        width: 1440,
        height: 1920,
      }
    );
  } catch (err: any) {
    console.error('PNG conversion error:', err);
    return new Response(`Failed to generate PNG: ${err.message}`, { status: 500 });
  }
}
