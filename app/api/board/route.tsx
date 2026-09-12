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
  
  const parts = new Intl.DateTimeFormat('zh-HK', {
    timeZone: 'Asia/Hong_Kong',
    month: 'numeric',
    day: 'numeric',
    weekday: 'short'
  }).formatToParts(now);

  const month = parts.find(p => p.type === 'month')?.value || '9';
  const day = parts.find(p => p.type === 'day')?.value || '12';
  
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

  // 繪製單個巴士區域（大幅向右平移班次分隔線）
  const renderSection = (title: string, width: number, data: any[], startY: number) => {
    const rowHeight = 112;
    return `
      <rect x="50" y="${startY}" width="${width}" height="66" rx="12" fill="#000000" />
      <text x="${50 + width / 2}" y="${startY + 45}" font-size="38" font-family="sans-serif" font-weight="bold" fill="#ffffff" text-anchor="middle">${title}</text>

      ${data.map((item, idx) => {
        const rowTop = startY + 90 + idx * rowHeight;
        const textY = rowTop + 68;
        const isOdd = idx % 2 === 1;
        const bgRect = isOdd ? `<rect x="50" y="${rowTop}" width="1340" height="${rowHeight}" fill="#f2f2f2" />` : '';

        const eta1 = item.etas[0] || '未有班次';
        const eta2 = item.etas[1] || '';
        const eta3 = item.etas[2] || '';

        return `
          ${bgRect}
          <!-- 路線號碼 -->
          <text x="70" y="${textY}" font-size="54" font-family="sans-serif" font-weight="900" fill="#000000">${item.route}</text>
          
          <!-- 目的地 -->
          <text x="260" y="${textY - 4}" font-size="35" font-family="sans-serif" font-weight="bold" fill="#333333">往 ${item.dest}</text>
          
          <!-- 垂直分界線 1：目的地與第一班次之間 (x=600) -->
          <line x1="600" y1="${rowTop + 14}" x2="600" y2="${rowTop + rowHeight - 14}" stroke="#d0d0d0" stroke-width="2" />

          <!-- 第一班次 (醒目大黑體，空間闊達 310px，對齊至 910) -->
          <text x="910" y="${textY}" font-size="44" font-family="sans-serif" font-weight="900" text-anchor="end" fill="#000000">${eta1}</text>
          
          <!-- 垂直分界線 2：第一與第二班次之間 (大幅右移至 940) -->
          <line x1="940" y1="${rowTop + 18}" x2="940" y2="${rowTop + rowHeight - 18}" stroke="#e0e0e0" stroke-width="2" />

          <!-- 第二班次 (右移至 1160) -->
          <text x="1160" y="${textY}" font-size="32" font-family="sans-serif" fill="#444444" text-anchor="end">${eta2}</text>
          
          <!-- 垂直分界線 3：第二與第三班次之間 (右移至 1180) -->
          <line x1="1180" y1="${rowTop + 18}" x2="1180" y2="${rowTop + rowHeight - 18}" stroke="#e0e0e0" stroke-width="2" />

          <!-- 第三班次 (右移貼齊 1380) -->
          <text x="1380" y="${textY}" font-size="28" font-family="sans-serif" fill="#777777" text-anchor="end">${eta3}</text>
          
          <!-- 底線 -->
          <line x1="50" y1="${rowTop + rowHeight}" x2="1390" y2="${rowTop + rowHeight}" stroke="#e8e8e8" stroke-width="2" />
        `;
      }).join('')}
    `;
  };

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

    <!-- 區域一：康栢苑 (6 條線) -->
    ${renderSection('康栢苑', 220, hpData, 205)}

    <!-- 區域二：廣田邨廣靖樓 (4 條線) -->
    ${renderSection('廣田邨廣靖樓', 340, kcData, 1020)}
  </svg>
  `;

  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}
