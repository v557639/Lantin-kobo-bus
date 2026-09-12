export const dynamic = 'force-dynamic';

// 康栢苑路線
const HONG_PAK_CONFIG = [
  { route: '16', dest: '旺角(柏景灣)', dir: 'O' },
  { route: '16X', dest: '旺角(柏景灣)', dir: 'O' },
  { route: '15X', dest: '紅磡站', dir: 'O' },
  { route: '215X', dest: '九龍站', dir: 'O' },
  { route: '216M', dest: '油塘站(循環線)', dir: 'O' },
  { route: '603', dest: '平田', dir: 'I' },
];

// 廣田邨廣靖樓路線
const KWONG_CHING_CONFIG = [
  { route: '603', dest: '中環(渡輪碼頭)', dir: 'O' },
  { route: '603S', dest: '中環(機利文街)', dir: 'O' },
  { route: '216M', dest: '油塘站(循環線)', dir: 'O' },
  { route: '88X', dest: '火炭(駿洋邨)', dir: 'O' },
];

// 天文台即時天氣 API
async function getWeather() {
  try {
    const res = await fetch('https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=rhrread&lang=tc', {
      cache: 'no-store'
    });
    const data = await res.json();
    
    const ktTemp = data?.temperature?.data?.find((i: any) => i.place.includes('觀塘') || i.place.includes('啟德'));
    const temp = ktTemp?.value ?? data?.temperature?.data?.[0]?.value ?? '--';
    const iconId = data?.icon?.[0] ?? 50;

    let weatherType = 'cloud';
    if ([50, 51, 52].includes(iconId)) weatherType = 'sun';
    else if ([62, 63, 64, 65].includes(iconId)) weatherType = 'rain';

    return { temp: `${temp}°C`, weatherType };
  } catch {
    return { temp: '--°C', weatherType: 'sun' };
  }
}

async function getEta(item: { route: string; dest: string; dir: string }) {
  try {
    const res = await fetch(`https://data.etabus.gov.hk/v1/transport/kmb/route-eta/${item.route}/1`, {
      cache: 'no-store'
    });
    const json = await res.json();
    if (!json?.data) return { route: item.route, dest: item.dest, etas: [] };

    const now = Date.now();
    const valid = json.data.filter((i: any) => {
      const matchDir = item.dir ? i.dir === item.dir : true;
      return matchDir && i.eta && new Date(i.eta).getTime() > now;
    });

    const displayDest = valid[0]?.dest_tc || item.dest;

    // 攞齊最多 3 個班次
    const etas = valid.slice(0, 3).map((i: any) => {
      const etaTime = new Date(i.eta);
      const diff = Math.round((etaTime.getTime() - now) / 60000);
      const timeStr = etaTime.toLocaleTimeString('zh-HK', {
        timeZone: 'Asia/Hong_Kong',
        hour12: false,
        hour: '2-digit',
        minute: '2-digit'
      });
      const minsText = diff <= 0 ? '即到' : `${diff}分`;
      return `${minsText} [${timeStr}]`;
    });

    return { route: item.route, dest: displayDest, etas };
  } catch (e) {
    return { route: item.route, dest: item.dest, etas: [] };
  }
}

export async function GET() {
  const now = new Date();
  
  const hkDateStr = now.toLocaleDateString('zh-HK', {
    timeZone: 'Asia/Hong_Kong',
    month: 'numeric',
    day: 'numeric'
  });
  const [month, day] = hkDateStr.split('/');
  
  const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  const dayIndex = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Hong_Kong' })).getDay();
  const fullDateStr = `${month}月${day}日 (${weekdays[dayIndex]})`;

  const timeStr = now.toLocaleTimeString('zh-HK', {
    timeZone: 'Asia/Hong_Kong',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit'
  });

  const [weather, hpData, kcData] = await Promise.all([
    getWeather(),
    Promise.all(HONG_PAK_CONFIG.map(getEta)),
    Promise.all(KWONG_CHING_CONFIG.map(getEta))
  ]);

  let weatherSvg = '';
  if (weather.weatherType === 'sun') {
    weatherSvg = `
      <g transform="translate(680, 48)">
        <circle cx="45" cy="45" r="26" fill="#000000" />
        <path d="M45 5 v12 M45 73 v12 M5 45 h12 M73 45 h12 M17 17 l9 9 M64 64 l9 9 M17 73 l9 -9 M64 17 l9 9" stroke="#000000" stroke-width="7" stroke-linecap="round" />
      </g>
    `;
  } else if (weather.weatherType === 'rain') {
    weatherSvg = `
      <g transform="translate(680, 45)">
        <path d="M25 45 a20 20 0 0 1 36 -8 a16 16 0 0 1 24 14 a14 14 0 0 1 -6 25 h-52 a18 18 0 0 1 -2 -31 z" fill="#000000" />
        <line x1="30" y1="82" x2="22" y2="100" stroke="#000000" stroke-width="6" stroke-linecap="round" />
        <line x1="50" y1="82" x2="42" y2="100" stroke="#000000" stroke-width="6" stroke-linecap="round" />
        <line x1="70" y1="82" x2="62" y2="100" stroke="#000000" stroke-width="6" stroke-linecap="round" />
      </g>
    `;
  } else {
    weatherSvg = `
      <g transform="translate(680, 48)">
        <path d="M30 52 a24 24 0 0 1 42 -10 a19 19 0 0 1 28 17 a16 16 0 0 1 -7 30 h-62 a21 21 0 0 1 -1 -37 z" fill="#000000" />
      </g>
    `;
  }

  const svg = `
  <svg width="1440" height="1920" viewBox="0 0 1440 1920" xmlns="http://www.w3.org/2000/svg">
    <rect width="1440" height="1920" fill="#ffffff" />
    
    <!-- Header -->
    <g>
      <text x="50" y="125" font-size="60" font-family="sans-serif" font-weight="900" fill="#000000">${fullDateStr}</text>
      ${weatherSvg}
      <text x="785" y="125" font-size="76" font-family="sans-serif" font-weight="900" fill="#000000">${weather.temp}</text>
      <text x="1390" y="125" font-size="88" font-family="sans-serif" font-weight="900" text-anchor="end" fill="#000000">${timeStr}</text>
      <line x1="50" y1="170" x2="1390" y2="170" stroke="#000000" stroke-width="8" />
    </g>

    <!-- 康栢苑 -->
    <rect x="50" y="215" width="220" height="66" rx="12" fill="#000000" />
    <text x="160" y="260" font-size="38" font-family="sans-serif" font-weight="bold" fill="#ffffff" text-anchor="middle">康栢苑</text>

    ${hpData.map((item, idx) => {
      const y = 360 + idx * 110;
      const eta1 = item.etas[0] || '未有班次';
      const eta2 = item.etas[1] || '';
      const eta3 = item.etas[2] || '';
      return `
        <text x="50" y="${y}" font-size="54" font-family="sans-serif" font-weight="900" fill="#000000">${item.route}</text>
        <text x="230" y="${y - 4}" font-size="32" font-family="sans-serif" fill="#444444">往 ${item.dest}</text>
        <text x="800" y="${y}" font-size="40" font-family="sans-serif" font-weight="900" text-anchor="end" fill="#000000">${eta1}</text>
        <text x="1100" y="${y}" font-size="32" font-family="sans-serif" fill="#555555" text-anchor="end">${eta2}</text>
        <text x="1390" y="${y}" font-size="28" font-family="sans-serif" fill="#888888" text-anchor="end">${eta3}</text>
        <line x1="50" y1="${y + 35}" x2="1390" y2="${y + 35}" stroke="#eeeeee" stroke-width="3" />
      `;
    }).join('')}

    <!-- 廣田邨廣靖樓 -->
    <rect x="50" y="1055" width="340" height="66" rx="12" fill="#000000" />
    <text x="220" y="1100" font-size="38" font-family="sans-serif" font-weight="bold" fill="#ffffff" text-anchor="middle">廣田邨廣靖樓</text>

    ${kcData.map((item, idx) => {
      const y = 1200 + idx * 110;
      const eta1 = item.etas[0] || '未有班次';
      const eta2 = item.etas[1] || '';
      const eta3 = item.etas[2] || '';
      return `
        <text x="50" y="${y}" font-size="54" font-family="sans-serif" font-weight="900" fill="#000000">${item.route}</text>
        <text x="230" y="${y - 4}" font-size="32" font-family="sans-serif" fill="#444444">往 ${item.dest}</text>
        <text x="800" y="${y}" font-size="40" font-family="sans-serif" font-weight="900" text-anchor="end" fill="#000000">${eta1}</text>
        <text x="1100" y="${y}" font-size="32" font-family="sans-serif" fill="#555555" text-anchor="end">${eta2}</text>
        <text x="1390" y="${y}" font-size="28" font-family="sans-serif" fill="#888888" text-anchor="end">${eta3}</text>
        <line x1="50" y1="${y + 35}" x2="1390" y2="${y + 35}" stroke="#eeeeee" stroke-width="3" />
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
