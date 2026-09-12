export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const svgUrl = `${url.origin}/api/board`;

    // 抓取原本的 SVG
    const svgRes = await fetch(svgUrl, { cache: 'no-store' });
    const svgText = await svgRes.text();

    // 叫專門處理 SVG 轉 PNG 的雲端引擎 (自帶全套 Noto CJK 中文字體) 轉成 1440x1920
    const renderRes = await fetch('https://svg-to-image.vercel.app/api/render', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        svg: svgText,
        width: 1440,
        height: 1920,
        format: 'png',
      }),
    });

    if (!renderRes.ok) {
      // 備用方案：如果外網代理失敗，直接回傳
      throw new Error('Render failed');
    }

    const pngBuffer = await renderRes.arrayBuffer();

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
