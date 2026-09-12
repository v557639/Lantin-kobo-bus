export const dynamic = 'force-dynamic';

const HONG_PAK_ROUTES = ['16', '16X', '216X', '216M', '603'];
const KWONG_CHING_ROUTES = ['603', '603S', '216M', '88X'];

// 天文台即時天氣 API
async function getWeather() {
  try {
    const res = await fetch('https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=rhrread&lang=tc', {
      cache: 'no-store'
    });
    const data = await res.json();
    
    // 搵觀塘/啟德/最接近藍田嘅氣溫，冇就用全港平均
    const ktTemp = data?.temperature?.data?.find((i: any) => i.place.includes('觀塘') || i.place.includes('啟德'));
    const temp = ktTemp?.value ?? data?.temperature?.data?.[0]?.value ?? '--';
    const iconId = data?.icon?.[0] ?? 50; // 天文台 icon code

    // 簡單判定晴朗/多雲/落雨 icon (用純向量畫，墨水屏高對比度)
    // 50-54=晴/陽光, 60-61=多雲, 62-65=有雨/雷暴
    let weatherType = 'cloud';
    if ([50, 51, 52].includes(iconId)) weatherType = 'sun';
    else if ([62, 63, 64, 65].includes(iconId)) weatherType = 'rain';

    return { temp: `${temp}°C`, weatherType };
  } catch {
    return { temp: '--°C', weatherType: 'sun' };
  }
}

async function getEta(route: string) {
  try {
    const res = await fetch(`https://data.etabus.gov.hk/v1/transport/kmb/route-eta/${route}/1`, {
      cache: 'no-store'
    });
    const json = await res.json();
    if (!json?.data) return { route, dest: '--', etas: [] };

    const now = Date.now();
    const valid = json.data.filter((i: any) => i.eta && new Date(i.eta).getTime() > now);
    const dest = valid[0]?.dest_tc || '市區方向';

    // 格式化：X分鐘 [HH:MM]
    const etas = valid.slice(0, 2).map((i: any) => {
      const etaTime = new Date(i.eta);
      const diff = Math.round((etaTime.getTime() - now) / 60000);
      const timeStr = etaTime.toLocaleTimeString('zh-HK', {
        timeZone: 'Asia/Hong_Kong',
        hour12: false,
        hour: '2-digit',
        minute: '2-digit'
      });
      const minsText = diff <= 0 ? '即到' : `${diff}分鐘`;
      return `${minsText} [${timeStr}]`;
    });

    return { route, dest, etas };
  } catch {
    return { route, dest: '--', etas: [] };
  }
}

export async function GET() {
  const now = new Date();
  
  // 日期與星期處理
  const dateStr = now.toLocaleDateString('zh-HK', {
    timeZone: 'Asia/Hong_Kong',
    month: 'numeric',
    day: 'numeric'
  });
  const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  const dayStr = weekdays[new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Hong_Kong' })).getDay()];
  
  const timeStr = now.toLocaleTimeString('zh-HK', {
    timeZone: 'Asia/Hong_Kong',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit'
  });

  const [weather, hpData, kcData] = await Promise.all([
    getWeather(),
    Promise.all(HONG_PAK_ROUTES.map(getEta)),
    Promise.all(KWONG_CHING_ROUTES.map(getEta))
  ]);

  // 純黑白高對比度天氣向量圖標
  let weatherSvg = '';
  if (weather.weatherType === 'sun') {
    weatherSvg = `
      <g transform="translate(680, 75)">
        <circle cx="35" cy="35" r="22" fill="#000000" />
        <path d="M35 0 v10 M35 60 v10 M0 35 h10 M60 35 h10 M10 10 l7 7 M53 53 l7 7 M10 60 l7 -7 M53 17 l7 -7" stroke="#000000" stroke-width="6" stroke-linecap="round" />
      </g>
    `;
  } else if (weather.weatherType === 'rain') {
    weatherSvg = `
      <g transform="translate(680, 70)">
        <path d="M20 40 a16 16 0 0 1 30 -6 a12 12 0 0 1 18 10 a10 10 0 0 1 -4 19 h-40 a14 14 0 0 1 -4 -23 z" fill="#000000" />
        <line x1="25" y1="70" x2="18" y2="86" stroke="#000000" stroke-width="5" stroke-linecap="round" />
        <line x1="42" y1="70" x2="35" y2="86" stroke="#000000" stroke-width="5" stroke-linecap="round" />
        <line x1="58" y1="70" x2="51" y2="86" stroke="#000000" stroke-width="5" stroke-linecap="round" />
      </g>
    `;
  } else {
    // 多雲
    weatherSvg = `
      <g transform="translate(680, 75)">
        <path d="M25 45 a20 20 0 0 1 36 -8 a16 16 0 0 1 24 14 a14 14 0 0 1 -6 25 h-52 a18 18 0 0 1 -2 -31 z" fill="#000000" />
      </g>
    `;
  }

  const svg = `
  <svg width="1440" height="1920" viewBox="0 0 1440 1920" xmlns="http://www.w3.org/2000/svg">
    <rect width="1440" height="1920" fill="#ffffff" />
    
    <!-- 頂部 Header：日期、星期、天氣公仔、氣溫、大時鐘 -->
    <g>
      <text x="60" y="110" font-size="52" font-family="sans-serif" font-weight="bold" fill="#000000">${dateStr}日 ${dayStr}</text>
      
      <!-- 天氣圖標與氣溫 -->
      ${weatherSvg}
      <text x="770" y="125" font-size="56" font-family="sans-serif" font-weight="900" fill="#000000">${weather.temp}</text>
      
      <!-- 當前時間 -->
      <text x="1380" y="125" font-size="96" font-family="sans-serif" font-weight="900" text-anchor="end" fill="#000000">${timeStr}</text>
      <line x1="60" y1="170" x2="1380" y2="170" stroke="#000000" stroke-width="8" />
    </g>

    <!-- 區域一：康栢苑 -->
    <rect x="60" y="210" width="650" height="64" rx="12" fill="#000000" />
    <text x="85" y="254" font-size="34" font-family="sans-serif" font-weight="bold" fill="#ffffff">康栢苑 (往旺角/尖沙咀/中環/油塘)</text>

    ${hpData.map((item, idx) => {
      const y = 350 + idx * 115;
      const firstEta = item.etas[0] || '未有班次';
      const secondEta = item.etas[1] ? `下班 ${item.etas[1]}` : '';
      return `
        <text x="60" y="${y}" font-size="56" font-family="sans-serif" font-weight="900" fill="#000000">${item.route}</text>
        <text x="250" y="${y - 4}" font-size="34" font-family="sans-serif" fill="#444444">往 ${item.dest}</text>
        <text x="1000" y="${y}" font-size="44" font-family="sans-serif" font-weight="900" text-anchor="end" fill="#000000">${firstEta}</text>
        <text x="1380" y="${y}" font-size="30" font-family="sans-serif" fill="#666666" text-anchor="end">${secondEta}</text>
        <line x1="60" y1="${y + 35}" x2="1380" y2="${y + 35}" stroke="#eeeeee" stroke-width="3" />
      `;
    }).join('')}

    <!-- 區域二：廣田邨廣靖樓 -->
    <rect x="60" y="990" width="650" height="64" rx="12" fill="#000000" />
    <text x="85" y="1034" font-size="34" font-family="sans-serif" font-weight="bold" fill="#ffffff">廣田邨廣靖樓 (往中環/沙田/油塘)</text>

    ${kcData.map((item, idx) => {
      const y = 1130 + idx * 115;
      const firstEta = item.etas[0] || '未有班次';
      const secondEta = item.etas[1] ? `下班 ${item.etas[1]}` : '';
      return `
        <text x="60" y="${y}" font-size="56" font-family="sans-serif" font-weight="900" fill="#000000">${item.route}</text>
        <text x="250" y="${y - 4}" font-size="34" font-family="sans-serif" fill="#444444">往 ${item.dest}</text>
        <text x="1000" y="${y}" font-size="44" font-family="sans-serif" font-weight="900" text-anchor="end" fill="#000000">${firstEta}</text>
        <text x="1380" y="${y}" font-size="30" font-family="sans-serif" fill="#666666" text-anchor="end">${secondEta}</text>
        <line x1="60" y1="${y + 35}" x2="1380" y2="${y + 35}" stroke="#eeeeee" stroke-width="3" />
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
