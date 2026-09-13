export const dynamic = 'force-dynamic';

// 康栢苑主力 (6 條：小巴 63 坐陣)
const HONG_PAK_PRIMARY = [
  { route: '16', dest: '旺角(柏景灣)', dir: 'O' },
  { route: '16X', dest: '旺角(柏景灣)', dir: 'O' },
  { route: '215X', dest: '九龍站', dir: 'O' },
  { route: '216M', dest: '油塘站(循環線)', dir: 'O' },
  { route: '603', dest: '平田', dir: 'I' },
  { route: '63', dest: '觀塘(裕民坊)', operator: 'gmb', gmbRegion: 'KLN', gmbRoute: '63', routeSeq: 1, stopSeq: 3 },
];

// 康栢苑其他 (保留 4 條排 2 行)
const HONG_PAK_SECONDARY = [
  { route: '15X', dest: '紅磡站', dir: 'O' },
  { route: '214', dest: '油塘', dir: 'O' },
  { route: '613', dest: '安泰', dir: 'I' },
  { route: '14H', dest: '順天', dir: 'I' },
];

// 廣田邨廣靖樓主力
const KWONG_CHING_PRIMARY = [
  { route: '603', dest: '中環(渡輪碼頭)', dir: 'O' },
  { route: '603S', dest: '中環(機利文街)', dir: 'O' },
  { route: '613', dest: '筲箕灣', dir: 'O' },
];

// 廣田邨廣靖樓其他 (保留 4 條排 2 行)
const KWONG_CHING_SECONDARY = [
  { route: '216M', dest: '油塘站(循環線)', dir: 'O' },
  { route: '214', dest: '長沙灣(甘泉街)', dir: 'I' },
  { route: '88X', dest: '火炭(駿洋邨)', dir: 'O' },
  { route: '14H', dest: '順利(循環線)', dir: 'I' },
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

async function getEta(item: any) {
  try {
    const now = Date.now();

    // 1. 城巴 API (Citybus)
    if (item.operator === 'ctb' && item.stopId) {
      const res = await fetch(`https://rt.data.gov.hk/v2/transport/citybus/eta/CTB/${item.stopId}/${item.route}`, {
        cache: 'no-store'
      });
      const json = await res.json();
      if (!json?.data) return { route: item.route, dest: item.dest, etas: [] };

      const valid = json.data.filter((i: any) => i.eta && new Date(i.eta).getTime() > now);
      const etas = valid.slice(0, 2).map((i: any) => {
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

      return { route: item.route, dest: valid[0]?.dest_tc || item.dest, etas };
    }

    // 2. 綠色專線小巴 API (GMB)
    if (item.operator === 'gmb') {
      try {
        const routeRes = await fetch(`https://data.etagmb.gov.hk/route/${item.gmbRegion}/${item.gmbRoute}`, {
          cache: 'no-store'
        });
        const routeJson = await routeRes.json();
        const routeId = routeJson?.data?.[0]?.route_id;

        if (routeId) {
          const rSeq = item.routeSeq || 1;
          const sSeq = item.stopSeq || 1;
          const etaRes = await fetch(`https://data.etagmb.gov.hk/eta/route-stop/${routeId}/${rSeq}/${sSeq}`, {
            cache: 'no-store'
          });
          const etaJson = await etaRes.json();
          const list = etaJson?.data?.eta || [];
          const etas = list.filter((i: any) => i.timestamp && new Date(i.timestamp).getTime() > now)
            .slice(0, 2)
            .map((i: any) => {
              const diff = i.diff !== undefined ? i.diff : Math.round((new Date(i.timestamp).getTime() - now) / 60000);
              const timeStr = new Date(i.timestamp).toLocaleTimeString('zh-HK', {
                timeZone: 'Asia/Hong_Kong',
                hour12: false,
                hour: '2-digit',
                minute: '2-digit'
              });
              const minsText = diff <= 0 ? '即到' : `${diff}分`;
              return `${minsText} [${timeStr}]`;
            });
          return { route: item.route, dest: item.dest, etas, isGmb: true };
        }
      } catch {}
      return { route: item.route, dest: item.dest, etas: [], isGmb: true };
    }

    // 3. 九巴 API (KMB)
    const res = await fetch(`https://data.etabus.gov.hk/v1/transport/kmb/route-eta/${item.route}/1`, {
      cache: 'no-store'
    });
    const json = await res.json();
    if (!json?.data) return { route: item.route, dest: item.dest, etas: [] };

    const valid = json.data.filter((i: any) => {
      const matchDir = item.dir ? (i.dir === item.dir) : true;
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
      const minsText = diff <= 0 ? '即到' : `${diff}分`;
      return `${minsText} [${timeStr}]`;
    });

    return { route: item.route, dest: displayDest, etas };
  } catch {
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
  const day = parts.find(p => p.type === 'day')?.value || '13';
  
  const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  const dayIndex = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Hong_Kong' })).getDay();
  const fullDateStr = `${month}月${day}日 (${weekdays[dayIndex]})`;

  const timeStr = now.toLocaleTimeString('zh-HK', {
    timeZone: 'Asia/Hong_Kong',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit'
  });

  const [weather, hpPri, hpSec, kcPri, kcSec] = await Promise.all([
    getWeather(),
    Promise.all(HONG_PAK_PRIMARY.map(getEta)),
    Promise.all(HONG_PAK_SECONDARY.map(getEta)),
    Promise.all(KWONG_CHING_PRIMARY.map(getEta)),
    Promise.all(KWONG_CHING_SECONDARY.map(getEta))
  ]);

  let weatherSvg = '';
  if (weather.weatherType === 'sun') {
    weatherSvg = `
      <g transform="translate(710, 68)">
        <circle cx="36" cy="36" r="20" fill="#000000" />
        <path d="M36 4 v10 M36 58 v10 M4 36 h10 M58 36 h10 M13 13 l8 8 M51 51 l8 8 M13 59 l8 -8 M51 13 l8 8" stroke="#000000" stroke-width="6" stroke-linecap="round" />
      </g>
    `;
  } else if (weather.weatherType === 'rain') {
    weatherSvg = `
      <g transform="translate(710, 65)">
        <path d="M20 38 a16 16 0 0 1 30 -6 a14 14 0 0 1 20 12 a12 12 0 0 1 -5 22 h-44 a15 15 0 0 1 -1 -28 z" fill="#000000" />
        <line x1="25" y1="70" x2="18" y2="86" stroke="#000000" stroke-width="5" stroke-linecap="round" />
        <line x1="42" y1="70" x2="35" y2="86" stroke="#000000" stroke-width="5" stroke-linecap="round" />
        <line x1="58" y1="70" x2="51" y2="86" stroke="#000000" stroke-width="5" stroke-linecap="round" />
      </g>
    `;
  } else {
    weatherSvg = `
      <g transform="translate(710, 68)">
        <path d="M25 45 a20 20 0 0 1 36 -8 a16 16 0 0 1 24 14 a14 14 0 0 1 -6 25 h-52 a18 18 0 0 1 -2 -31 z" fill="#000000" />
      </g>
    `;
  }

  const renderArea = (title: string, width: number, priData: any[], secData: any[], startY: number) => {
    const priRowH = 104;
    const secRowH = 70;
    let curY = startY;

    // 分區黑標題
    const titleSvg = `
      <rect x="50" y="${curY}" width="${width}" height="56" rx="10" fill="#000000" />
      <text x="${50 + width / 2}" y="${curY + 40}" font-size="34" font-family="sans-serif" font-weight="bold" fill="#ffffff" text-anchor="middle">${title}</text>
    `;
    curY += 68;

    // 主力常搭路線
    const priSvg = priData.map((item, idx) => {
      const rowTop = curY + idx * priRowH;
      const textY = rowTop + 72;
      const isOdd = idx % 2 === 1;
      const bgRect = isOdd ? `<rect x="50" y="${rowTop}" width="1340" height="${priRowH}" fill="#f4f4f4" />` : '';

      const eta1 = item.etas[0] || '未有班次';
      const eta2 = item.etas[1] || '';
      
      const badge = item.isGmb ? `<rect x="52" y="${rowTop + 33}" width="52" height="30" rx="4" fill="#000000" /><text x="78" y="${rowTop + 54}" font-size="16" font-family="sans-serif" font-weight="bold" fill="#ffffff" text-anchor="middle">小巴</text>` : '';
      const routeX = item.isGmb ? '120' : '65';

      return `
        ${bgRect}
        ${badge}
        <text x="${routeX}" y="${textY}" font-size="68" font-family="sans-serif" font-weight="900" fill="#000000">${item.route}</text>
        <text x="300" y="${textY - 4}" font-size="42" font-family="sans-serif" font-weight="bold" fill="#111111">往 ${item.dest}</text>
        
        <line x1="670" y1="${rowTop + 14}" x2="670" y2="${rowTop + priRowH - 14}" stroke="#cccccc" stroke-width="2" />
        <text x="1030" y="${textY}" font-size="62" font-family="sans-serif" font-weight="900" text-anchor="end" fill="#000000">${eta1}</text>
        
        <line x1="1060" y1="${rowTop + 18}" x2="1060" y2="${rowTop + priRowH - 18}" stroke="#dcdcdc" stroke-width="2" />
        <text x="1380" y="${textY}" font-size="52" font-family="sans-serif" font-weight="bold" fill="#222222" text-anchor="end">${eta2}</text>
        
        <line x1="50" y1="${rowTop + priRowH}" x2="1390" y2="${rowTop + priRowH}" stroke="#e2e2e2" stroke-width="2" />
      `;
    }).join('');

    curY += priData.length * priRowH + 10;

    // 其他路線標籤
    const secTag = `
      <text x="54" y="${curY + 22}" font-size="24" font-family="sans-serif" font-weight="bold" fill="#777777">其他路線 / 專線小巴</text>
    `;
    curY += 32;

    // 其他路線雙欄 (目的地改為 26px，留出足夠寬度防止擠逼)
    let secSvg = '';
    const numRows = Math.ceil(secData.length / 2);

    for (let r = 0; r < numRows; r++) {
      const rowTop = curY + r * secRowH;
      const textY = rowTop + 49;
      const leftItem = secData[r * 2];
      const rightItem = secData[r * 2 + 1];

      const leftEta = leftItem?.etas[0] || '未有班次';
      const leftBadge = leftItem?.isGmb ? `<rect x="58" y="${rowTop + 17}" width="42" height="26" rx="4" fill="#000000" /><text x="79" y="${rowTop + 35}" font-size="14" font-family="sans-serif" font-weight="bold" fill="#ffffff" text-anchor="middle">小巴</text>` : '';
      const leftRouteX = leftItem?.isGmb ? '114' : '65';

      const leftCol = leftItem ? `
        ${leftBadge}
        <text x="${leftRouteX}" y="${textY}" font-size="42" font-family="sans-serif" font-weight="900" fill="#222222">${leftItem.route}</text>
        <text x="195" y="${textY - 2}" font-size="26" font-family="sans-serif" font-weight="500" fill="#444444">往 ${leftItem.dest}</text>
        <text x="690" y="${textY}" font-size="38" font-family="sans-serif" font-weight="bold" text-anchor="end" fill="#000000">${leftEta}</text>
      ` : '';

      const midLine = `<line x1="710" y1="${rowTop + 8}" x2="710" y2="${rowTop + secRowH - 8}" stroke="#d0d0d0" stroke-width="2" />`;

      const rightEta = rightItem?.etas[0] || (rightItem ? '未有班次' : '');
      const rightBadge = rightItem?.isGmb ? `<rect x="736" y="${rowTop + 17}" width="42" height="26" rx="4" fill="#000000" /><text x="757" y="${rowTop + 35}" font-size="14" font-family="sans-serif" font-weight="bold" fill="#ffffff" text-anchor="middle">小巴</text>` : '';
      const rightRouteX = rightItem?.isGmb ? '790' : '740';

      const rightCol = rightItem ? `
        ${rightBadge}
        <text x="${rightRouteX}" y="${textY}" font-size="42" font-family="sans-serif" font-weight="900" fill="#222222">${rightItem.route}</text>
        <text x="870" y="${textY - 2}" font-size="26" font-family="sans-serif" font-weight="500" fill="#444444">往 ${rightItem.dest}</text>
        <text x="1375" y="${textY}" font-size="38" font-family="sans-serif" font-weight="bold" text-anchor="end" fill="#000000">${rightEta}</text>
      ` : '';

      const bottomLine = `<line x1="50" y1="${rowTop + secRowH}" x2="1390" y2="${rowTop + secRowH}" stroke="#ebebeb" stroke-width="1.5" stroke-dasharray="6,4" />`;

      secSvg += leftCol + midLine + rightCol + bottomLine;
    }

    return titleSvg + priSvg + secTag + secSvg;
  };

  const svg = `
  <svg width="1440" height="1920" viewBox="0 0 1440 1920" xmlns="http://www.w3.org/2000/svg">
    <rect width="1440" height="1920" fill="#ffffff" />
    
    <!-- Header -->
    <g>
      <text x="50" y="125" font-size="60" font-family="sans-serif" font-weight="900" fill="#000000">${fullDateStr}</text>
      ${weatherSvg}
      <text x="800" y="125" font-size="60" font-family="sans-serif" font-weight="900" fill="#000000">${weather.temp}</text>
      <text x="1390" y="125" font-size="60" font-family="sans-serif" font-weight="900" text-anchor="end" fill="#000000">${timeStr}</text>
      <line x1="50" y1="165" x2="1390" y2="165" stroke="#000000" stroke-width="8" />
    </g>

    <!-- 區域一：康栢苑 (主力 6 條 + 備用 4 條雙欄) -->
    ${renderArea('康栢苑', 200, hpPri, hpSec, 195)}

    <!-- 區域二：廣田邨廣靖樓 (起點 Y=1150) -->
    ${renderArea('廣田邨廣靖樓', 320, kcPri, kcSec, 1150)}
  </svg>
  `;

  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}
