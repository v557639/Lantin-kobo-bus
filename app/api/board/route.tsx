export const dynamic = 'force-dynamic';

// 康栢苑主力 (站名鎖定：康栢苑龍栢閣)
const HONG_PAK_PRIMARY = [
  { route: '16', dest: '旺角(柏景灣)', dir: 'outbound', targetStop: '康栢苑' },
  { route: '16X', dest: '旺角(柏景灣)', dir: 'outbound', targetStop: '康栢苑' },
  { route: '215X', dest: '九龍站', dir: 'outbound', targetStop: '康栢苑' },
  { route: '216M', dest: '油塘站(循環線)', dir: 'outbound', targetStop: '康栢苑' },
  { route: '603', dest: '平田', dir: 'inbound', targetStop: '康栢苑' },
  { route: '63', dest: '觀塘(裕民坊)', operator: 'gmb', gmbRegion: 'KLN', gmbRoute: '63', routeSeq: 1, stopSeq: 3 },
];

// 康栢苑其他
const HONG_PAK_SECONDARY = [
  { route: '15X', dest: '紅磡站', dir: 'outbound', targetStop: '康栢苑' },
  { route: '214', dest: '長沙灣(甘泉街)', dir: 'inbound', targetStop: '康栢苑' },
  { route: '613', dest: '安泰(西)(和泰樓)', dir: 'inbound', targetStop: '康栢苑' },
  { route: '14H', dest: '順天', dir: 'inbound', targetStop: '康栢苑' },
];

// 廣田邨廣靖樓主力 (站名鎖定：廣田邨廣靖樓，絕不找商場)
const KWONG_CHING_PRIMARY = [
  { route: '603', dest: '中環(渡輪碼頭)', dir: 'outbound', targetStop: '廣靖樓' },
  { route: '603S', dest: '中環(機利文街)', dir: 'outbound', targetStop: '廣靖樓' },
  { route: '613', dest: '筲箕灣', dir: 'outbound', targetStop: '廣靖樓' },
];

// 廣田邨廣靖樓其他
const KWONG_CHING_SECONDARY = [
  { route: '216M', dest: '油塘站(循環線)', dir: 'outbound', targetStop: '廣靖樓' },
  { route: '214', dest: '油塘', dir: 'outbound', targetStop: '廣靖樓' },
  { route: '88X', dest: '火炭(駿洋邨)', dir: 'outbound', targetStop: '廣靖樓' },
  { route: '14H', dest: '順利(循環線)', dir: 'inbound', targetStop: '廣靖樓' },
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

function parseEta(etaStr: string): Date | null {
  if (!etaStr) return null;
  const d = new Date(etaStr);
  return isNaN(d.getTime()) ? null : d;
}

// 核心：利用官方 route-eta 配合精確比對，只抓取目的地同方向正確的班次
async function getEta(item: any) {
  try {
    const now = Date.now();

    // 1. 綠色專線小巴 63 號
    if (item.operator === 'gmb') {
      try {
        const routeRes = await fetch(`https://data.etagmb.gov.hk/route/${item.gmbRegion}/${item.gmbRoute}`, { cache: 'no-store' });
        const routeJson = await routeRes.json();
        const routeId = routeJson?.data?.[0]?.route_id;

        if (routeId) {
          const rSeq = item.routeSeq || 1;
          const sSeq = item.stopSeq || 1;
          const etaRes = await fetch(`https://data.etagmb.gov.hk/eta/route-stop/${routeId}/${rSeq}/${sSeq}`, { cache: 'no-store' });
          const etaJson = await etaRes.json();
          const list = etaJson?.data?.eta || [];
          
          const etas = list
            .map((i: any) => {
              const etaDate = parseEta(i.timestamp);
              if (!etaDate || etaDate.getTime() <= now - 45000) return null;
              const diff = Math.round((etaDate.getTime() - now) / 60000);
              const timeStr = etaDate.toLocaleTimeString('zh-HK', {
                timeZone: 'Asia/Hong_Kong',
                hour12: false,
                hour: '2-digit',
                minute: '2-digit'
              });
              const minsText = diff <= 0 ? '即到' : `${diff}分`;
              return `${minsText} [${timeStr}]`;
            })
            .filter(Boolean)
            .slice(0, 2);

          return { route: item.route, dest: item.dest, etas, isGmb: true };
        }
      } catch {}
      return { route: item.route, dest: item.dest, etas: [], isGmb: true };
    }

    // 2. 九巴路線：向九巴官方 route-eta 請求該路線資料
    const res = await fetch(`https://data.etabus.gov.hk/v1/transport/kmb/route-eta/${item.route}/1`, {
      cache: 'no-store'
    });
    const json = await res.json();
    if (!json?.data || !Array.isArray(json.data)) return { route: item.route, dest: item.dest, etas: [] };

    // 方向代號轉換
    const dirCode = item.dir === 'outbound' ? 'O' : 'I';

    // 關鍵過濾：
    // 找出所有符合方向，且該筆記錄對應的站點包含指定關鍵字（康栢苑 或 廣靖樓）
    // 九巴 API 官方欄位：dir, eta, rmk_tc, dest_tc, seq
    let valid = json.data.filter((i: any) => {
      const matchDir = i.dir === dirCode;
      const etaDate = parseEta(i.eta);
      return matchDir && etaDate && (etaDate.getTime() > now - 45000);
    });

    // 根據碧雲道地理位置鎖定分站序號，絕不容許抓總站 (seq 1)：
    // 廣靖樓（第 2 或第 3 站，出九龍/港島方向）
    // 康栢苑（第 2 或第 4 站）
    if (item.targetStop === '廣靖樓') {
      if (item.route === '603' || item.route === '603S') {
        valid = valid.filter((i: any) => i.seq === 3 || i.seq === 2);
      } else if (item.route === '613') {
        valid = valid.filter((i: any) => i.seq >= 20 && i.seq <= 24);
      } else {
        valid = valid.filter((i: any) => i.seq > 1 && i.seq <= 5);
      }
    } else if (item.targetStop === '康栢苑') {
      if (item.route === '16' || item.route === '16X' || item.route === '215X') {
        valid = valid.filter((i: any) => i.seq === 2 || i.seq === 4);
      } else if (item.route === '603') {
        valid = valid.filter((i: any) => i.seq >= 22 && i.seq <= 26);
      } else {
        valid = valid.filter((i: any) => i.seq > 1);
      }
    }

    // 依到站時間由近至遠排序
    valid.sort((a: any, b: any) => new Date(a.eta).getTime() - new Date(b.eta).getTime());

    const seenTimes = new Set();
    const etas: string[] = [];

    for (const entry of valid) {
      const etaDate = parseEta(entry.eta);
      if (!etaDate) continue;

      const diff = Math.round((etaDate.getTime() - now) / 60000);
      const timeStr = etaDate.toLocaleTimeString('zh-HK', {
        timeZone: 'Asia/Hong_Kong',
        hour12: false,
        hour: '2-digit',
        minute: '2-digit'
      });

      if (!seenTimes.has(timeStr)) {
        seenTimes.add(timeStr);
        const minsText = diff <= 0 ? '即到' : `${diff}分`;
        etas.push(`${minsText} [${timeStr}]`);
      }
      if (etas.length >= 2) break;
    }

    return { route: item.route, dest: item.dest, etas };
  } catch {
    return { route: item.route, dest: item.dest, etas: [] };
  }
}

async function fetchInBatches(items: any[], batchSize = 4) {
  const results: any[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchRes = await Promise.all(batch.map(getEta));
    results.push(...batchRes);
  }
  return results;
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
  const day = parts.find(p => p.type === 'day')?.value || '14';
  
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
    fetchInBatches(HONG_PAK_PRIMARY, 4),
    fetchInBatches(HONG_PAK_SECONDARY, 4),
    fetchInBatches(KWONG_CHING_PRIMARY, 4),
    fetchInBatches(KWONG_CHING_SECONDARY, 4)
  ]);

  let weatherSvg = '';
  if (weather.weatherType === 'sun') {
    weatherSvg = `
      <g transform="translate(715, 52)">
        <circle cx="36" cy="36" r="20" fill="#000000" />
        <path d="M36 4 v10 M36 58 v10 M4 36 h10 M58 36 h10 M13 13 l8 8 M51 51 l8 8 M13 59 l8 -8 M51 13 l8 8" stroke="#000000" stroke-width="6" stroke-linecap="round" />
      </g>
    `;
  } else if (weather.weatherType === 'rain') {
    weatherSvg = `
      <g transform="translate(715, 48)">
        <path d="M20 38 a16 16 0 0 1 30 -6 a14 14 0 0 1 20 12 a12 12 0 0 1 -5 22 h-44 a15 15 0 0 1 -1 -28 z" fill="#000000" />
        <line x1="25" y1="70" x2="18" y2="86" stroke="#000000" stroke-width="5" stroke-linecap="round" />
        <line x1="42" y1="70" x2="35" y2="86" stroke="#000000" stroke-width="5" stroke-linecap="round" />
        <line x1="58" y1="70" x2="51" y2="86" stroke="#000000" stroke-width="5" stroke-linecap="round" />
      </g>
    `;
  } else {
    weatherSvg = `
      <g transform="translate(715, 50)">
        <path d="M25 45 a20 20 0 0 1 36 -8 a16 16 0 0 1 24 14 a14 14 0 0 1 -6 25 h-52 a18 18 0 0 1 -2 -31 z" fill="#000000" />
      </g>
    `;
  }

  const renderArea = (title: string, width: number, priData: any[], secData: any[], startY: number) => {
    const priRowH = 118;
    const secRowH = 82;
    let curY = startY;

    const titleSvg = `
      <rect x="50" y="${curY}" width="${width}" height="60" rx="10" fill="#000000" />
      <text x="${50 + width / 2}" y="${curY + 43}" font-size="36" font-family="sans-serif" font-weight="bold" fill="#ffffff" text-anchor="middle">${title}</text>
    `;
    curY += 76;

    const priSvg = priData.map((item, idx) => {
      const rowTop = curY + idx * priRowH;
      const textY = rowTop + 82;
      const isOdd = idx % 2 === 1;
      const bgRect = isOdd ? `<rect x="50" y="${rowTop}" width="1340" height="${priRowH}" fill="#f4f4f4" />` : '';

      const eta1 = item.etas[0] || '未有班次';
      const eta2 = item.etas[1] || '';
      
      const badge = item.isGmb ? `<rect x="50" y="${rowTop + 38}" width="54" height="34" rx="4" fill="#000000" /><text x="77" y="${rowTop + 62}" font-size="16" font-family="sans-serif" font-weight="bold" fill="#ffffff" text-anchor="middle">小巴</text>` : '';
      const routeX = item.isGmb ? '120' : '65';

      return `
        ${bgRect}
        ${badge}
        <text x="${routeX}" y="${textY}" font-size="74" font-family="sans-serif" font-weight="900" fill="#000000">${item.route}</text>
        <text x="270" y="${textY - 4}" font-size="38" font-family="sans-serif" font-weight="bold" fill="#111111">往 ${item.dest}</text>
        
        <line x1="615" y1="${rowTop + 16}" x2="615" y2="${rowTop + priRowH - 16}" stroke="#cccccc" stroke-width="2" />
        <text x="1025" y="${textY}" font-size="68" font-family="sans-serif" font-weight="900" text-anchor="end" fill="#000000">${eta1}</text>
        
        <line x1="1045" y1="${rowTop + 20}" x2="1045" y2="${rowTop + priRowH - 20}" stroke="#dcdcdc" stroke-width="2" />
        <text x="1380" y="${textY}" font-size="56" font-family="sans-serif" font-weight="bold" fill="#222222" text-anchor="end">${eta2}</text>
        
        <line x1="50" y1="${rowTop + priRowH}" x2="1390" y2="${rowTop + priRowH}" stroke="#e2e2e2" stroke-width="2" />
      `;
    }).join('');

    curY += priData.length * priRowH + 16;

    const secTag = `
      <text x="54" y="${curY + 22}" font-size="24" font-family="sans-serif" font-weight="bold" fill="#777777">其他路線</text>
    `;
    curY += 36;

    let secSvg = '';
    const numRows = Math.ceil(secData.length / 2);

    for (let r = 0; r < numRows; r++) {
      const rowTop = curY + r * secRowH;
      const textY = rowTop + 55;
      const leftItem = secData[r * 2];
      const rightItem = secData[r * 2 + 1];

      const leftEta = leftItem?.etas[0] || '未有班次';
      const leftBadge = leftItem?.isGmb ? `<rect x="58" y="${rowTop + 22}" width="42" height="28" rx="4" fill="#000000" /><text x="79" y="${rowTop + 42}" font-size="14" font-family="sans-serif" font-weight="bold" fill="#ffffff" text-anchor="middle">小巴</text>` : '';
      const leftRouteX = leftItem?.isGmb ? '114' : '65';

      const leftCol = leftItem ? `
        ${leftBadge}
        <text x="${leftRouteX}" y="${textY}" font-size="44" font-family="sans-serif" font-weight="900" fill="#222222">${leftItem.route}</text>
        <text x="205" y="${textY - 2}" font-size="26" font-family="sans-serif" font-weight="500" fill="#444444">往 ${leftItem.dest}</text>
        <text x="690" y="${textY}" font-size="38" font-family="sans-serif" font-weight="bold" text-anchor="end" fill="#000000">${leftEta}</text>
      ` : '';

      const midLine = `<line x1="710" y1="${rowTop + 10}" x2="710" y2="${rowTop + secRowH - 10}" stroke="#d0d0d0" stroke-width="2" />`;

      const rightEta = rightItem?.etas[0] || (rightItem ? '未有班次' : '');
      const rightBadge = rightItem?.isGmb ? `<rect x="736" y="${rowTop + 22}" width="42" height="28" rx="4" fill="#000000" /><text x="757" y="${rowTop + 42}" font-size="14" font-family="sans-serif" font-weight="bold" fill="#ffffff" text-anchor="middle">小巴</text>` : '';
      const rightRouteX = rightItem?.isGmb ? '790' : '740';

      const rightCol = rightItem ? `
        ${rightBadge}
        <text x="${rightRouteX}" y="${textY}" font-size="44" font-family="sans-serif" font-weight="900" fill="#222222">${rightItem.route}</text>
        <text x="880" y="${textY - 2}" font-size="26" font-family="sans-serif" font-weight="500" fill="#444444">往 ${rightItem.dest}</text>
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

    <!-- 區域一：康栢苑 (過濾排除總站，鎖定康栢苑站) -->
    ${renderArea('康栢苑', 200, hpPri, hpSec, 195)}

    <!-- 區域二：廣田邨廣靖樓 (過濾排除總站，鎖定廣靖樓站) -->
    ${renderArea('廣田邨廣靖樓', 320, kcPri, kcSec, 1230)}
  </svg>
  `;

  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}
