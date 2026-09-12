export const dynamic = 'force-dynamic';

const HONG_PAK_ROUTES = ['16', '16X', '216X', '216M', '603'];
const KWONG_CHING_ROUTES = ['603', '603S', '216M', '88X'];

async function getEta(route: string) {
  try {
    const res = await fetch(`https://data.etabus.gov.hk/v1/transport/kmb/route-eta/${route}/1`, {
      cache: 'no-store'
    });
    const json = await res.json();
    if (!json?.data) return { route, dest: '--', etas: ['--'] };

    const now = Date.now();
    const valid = json.data.filter((i: any) => i.eta && new Date(i.eta).getTime() > now);
    const dest = valid[0]?.dest_tc || '市區方向';
    const etas = valid.slice(0, 2).map((i: any) => {
      const diff = Math.round((new Date(i.eta).getTime() - now) / 60000);
      return diff <= 0 ? '即到' : `${diff}分`;
    });

    return { route, dest, etas: etas.length > 0 ? etas : ['--'] };
  } catch (e) {
    return { route, dest: '--', etas: ['--'] };
  }
}

export async function GET() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('zh-HK', {
    timeZone: 'Asia/Hong_Kong',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit'
  });

  const [hpData, kcData] = await Promise.all([
    Promise.all(HONG_PAK_ROUTES.map(getEta)),
    Promise.all(KWONG_CHING_ROUTES.map(getEta))
  ]);

  const svg = `
  <svg width="1440" height="1920" viewBox="0 0 1440 1920" xmlns="http://www.w3.org/2000/svg">
    <rect width="1440" height="1920" fill="#ffffff" />
    
    <text x="60" y="120" font-size="64" font-family="sans-serif" font-weight="900" fill="#000000">藍田交通看板</text>
    <text x="60" y="165" font-size="28" font-family="sans-serif" fill="#666666">LAM TIN REAL-TIME ETA</text>
    <text x="1380" y="130" font-size="80" font-family="sans-serif" font-weight="900" text-anchor="end" fill="#000000">${timeStr}</text>
    <line x1="60" y1="200" x2="1380" y2="200" stroke="#000000" stroke-width="8" />

    <rect x="60" y="240" width="650" height="60" rx="10" fill="#000000" />
    <text x="80" y="282" font-size="34" font-family="sans-serif" font-weight="bold" fill="#ffffff">康栢苑 (往旺角/尖沙咀/中環/油塘)</text>

    ${hpData.map((item, idx) => {
      const y = 370 + idx * 105;
      return `
        <text x="60" y="${y}" font-size="52" font-family="sans-serif" font-weight="900" fill="#000000">${item.route}</text>
        <text x="260" y="${y}" font-size="36" font-family="sans-serif" fill="#333333">往 ${item.dest}</text>
        <text x="1100" y="${y}" font-size="56" font-family="sans-serif" font-weight="900" text-anchor="end" fill="#000000">${item.etas[0] || '--'}</text>
        <text x="1380" y="${y}" font-size="32" font-family="sans-serif" fill="#777777" text-anchor="end">${item.etas[1] ? '下班 ' + item.etas[1] : ''}</text>
        <line x1="60" y1="${y + 30}" x2="1380" y2="${y + 30}" stroke="#eeeeee" stroke-width="3" />
      `;
    }).join('')}

    <rect x="60" y="920" width="650" height="60" rx="10" fill="#000000" />
    <text x="80" y="962" font-size="34" font-family="sans-serif" font-weight="bold" fill="#ffffff">廣田邨廣靖樓 (往中環/沙田/油塘)</text>

    ${kcData.map((item, idx) => {
      const y = 1050 + idx * 105;
      return `
        <text x="60" y="${y}" font-size="52" font-family="sans-serif" font-weight="900" fill="#000000">${item.route}</text>
        <text x="260" y="${y}" font-size="36" font-family="sans-serif" fill="#333333">往 ${item.dest}</text>
        <text x="1100" y="${y}" font-size="56" font-family="sans-serif" font-weight="900" text-anchor="end" fill="#000000">${item.etas[0] || '--'}</text>
        <text x="1380" y="${y}" font-size="32" font-family="sans-serif" fill="#777777" text-anchor="end">${item.etas[1] ? '下班 ' + item.etas[1] : ''}</text>
        <line x1="60" y1="${y + 30}" x2="1380" y2="${y + 30}" stroke="#eeeeee" stroke-width="3" />
      `;
    }).join('')}
  </svg>
  `;

  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}
