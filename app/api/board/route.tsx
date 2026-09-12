export const dynamic = 'force-dynamic';

// 康栢苑路線（216X 已換成 215X 往九龍站）
const HONG_PAK_CONFIG = [
  { route: '16', dest: '旺角(柏景灣)', dir: 'O' },
  { route: '16X', dest: '旺角(柏景灣)', dir: 'O' },
  { route: '15X', dest: '紅磡站', dir: 'O' },
  { route: '215X', dest: '九龍站', dir: 'O' },
  { route: '216M', dest: '油塘站(循環線)', dir: 'O' },
  { route: '603', dest: '平田', dir: 'I' }, // 往平田方向 (Inbound)
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

    return { route: item.route, dest: displayDest, etas };
  } catch (e) {
    return { route: item.route, dest: item.dest, etas: [] };
  }
}

export async function GET() {
  const now = new Date();
  
  const yearStr = now.toLocaleDateString('zh-HK', { timeZone: 'Asia/Hong_Kong', year: 'numeric' });
  const monthStr = now.toLocaleDateString('zh-HK', { timeZone: 'Asia/Hong_Kong', month: 'numeric' });
  const dayNumStr = now.toLocaleDateString('zh-HK', { timeZone: 'Asia/Hong_Kong', day: 'numeric' });
  
  const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  const dayStr = weekdays[new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Hong_Kong' })).getDay()];
  const fullDateStr = `${yearStr}年${monthStr}月${dayNumStr}日 ${dayStr}`;

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
      <g transform="translate(850, 48)">
        <circle cx="45" cy="45" r="26" fill="#000000" />
        <path d="M45 5 v12 M45 73 v12 M5 45 h12 M73 45 h12 M17 17 l9 9 M64 64 l9 9 M17 73 l9 -9 M64 17 l9 9" stroke="#000000" stroke-width="7" stroke-linecap="round" />
      </g>
    `;
  } else if (weather.weatherType === 'rain') {
    weatherSvg = `
      <g transform="translate(850, 45)">
        <path d="M25 45 a20 20 0 0 1 36 -8 a16 16 0 0 1 24 14 a14 14 0 0 1 -6 25 h-52 a18 18 0 0 1 -2 -31 z" fill="#000000" />
        <line x1="30" y1="82" x2="22" y2="100" stroke="#000000" stroke-width="6" stroke-linecap="round" />
        <line x1="50" y1="82" x2="42" y2="100" stroke="#000000" stroke-width="6" stroke-linecap="round" />
        <line x1="70" y1="82" x2="62" y2="100" stroke="#000000" stroke-width="6" stroke-linecap="round" />
      </g>
    `;
  } else {
    weatherSvg = `
      <g transform="translate(850, 48)">
        <path d="M30 52 a24 24 0 0 1 42 -10 a19 19 0 0 1 28 17 a16 16 0 0 1 -7 30 h-62 a21 21 0 0 1 -1 -37 z" fill="#000000" />
      </g>
    `;
  }

  const svg = `
  <svg width="1440" height="1920" viewBox="0 0 1440 1920" xmlns="http://www.w3.org/2000/svg">
    <rect width="1440" height="1920" fill="#ffffff" />
    
    <!-- 頂部 Header：日期、星期、天氣、溫度、時間 對齊 -->
    <g>
      <text x="50" y="118" font-size="52" font-family="sans-serif" font-weight="bold" fill="#000000">${fullDateStr}</text>
      ${weatherSvg}
      <text x="955" y="122" font-size="82" font-family="sans-serif" font-weight="900" fill="#000000">${weather.temp}</text>
      <text x="1390" y="122" font-size="82" font-family="sans-serif" font-weight="900" text-anchor="end" fill="#000000">${timeStr}</text>
      <line x1="50" y1="165" x2="1390" y2="165" stroke="#000000" stroke-width="8" />
    </g>

    <!-- 區域一：康栢苑 (6 條線) -->
    <rect x="50" y="205" width="670" height="64" rx="12" fill="#000000" />
    <text x="75" y="250" font-size="34" font-family="sans-serif" font-weight="bold" fill="#ffffff">康栢苑 (往旺角/尖沙咀/紅磡/平田/油塘)</text>

    ${hpData.map((item, idx) => {
      const y = 345 + idx * 110;
      const firstEta = item.etas[0] || '未有班次';
      const secondEta = item.etas[1] ? `下班 ${item.etas[1]}` : '';
      return `
        <text x="50" y="${y}" font-size="54" font-family="sans-serif" font-weight="900" fill="#000000">${item.route}</text>
        <text x="250" y="${y - 4}" font-size="34" font-family="sans-serif" fill="#444444">往 ${item.dest}</text>
        <text x="990" y="${y}" font-size="44" font-family="sans-serif" font-weight="900" text-anchor="end" fill="#000000">${firstEta}</text>
        <text x="1390" y="${y}" font-size="30" font-family="sans-serif" fill="#666666" text-anchor="end">${secondEta}</text>
        <line x1="50" y1="${y + 35}" x2="1390" y2="${y + 35}" stroke="#eeeeee" stroke-width="3" />
      `;
    }).join('')}

    <!-- 區域二：廣田邨廣靖樓 (4 條線) -->
    <rect x="50" y="1050" width="670" height="64" rx="12" fill="#000000" />
    <text x="75" y="1095" font-size="34" font-family="sans-serif" font-weight="bold" fill="#ffffff">廣田邨廣靖樓 (往中環/沙田/油塘)</text>

    ${kcData.map((item, idx) => {
      const y = 1195 + idx * 110;
      const firstEta = item.etas[0] || '未有班次';
      const secondEta = item.etas[1] ? `下班 ${item.etas[1]}` : '';
      return `
        <text x="50" y="${y}" font-size="54" font-family="sans-serif" font-weight="900" fill="#000000">${item.route}</text>
        <text x="250" y="${y - 4}" font-size="34" font-family="sans-serif" fill="#444444">往 ${item.dest}</text>
        <text x="990" y="${y}" font-size="44" font-family="sans-serif" font-weight="900" text-anchor="end" fill="#000000">${firstEta}</text>
        <text x="1390" y="${y}" font-size="30" font-family="sans-serif" fill="#666666" text-anchor="end">${secondEta}</text>
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
