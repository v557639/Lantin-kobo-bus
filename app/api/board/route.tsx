export const dynamic = 'force-dynamic';

// 康栢苑主力
const HONG_PAK_PRIMARY = [
  { route: '16', dest: '旺角(柏景灣)', dir: 'O' },
  { route: '16X', dest: '旺角(柏景灣)', dir: 'O' },
  { route: '215X', dest: '九龍站', dir: 'O' },
  { route: '216M', dest: '油塘站(循環線)', dir: 'O' },
  { route: '603', dest: '平田', dir: 'I' },
];

// 康栢苑其他（雙欄顯示：加入 14H, A26）
const HONG_PAK_SECONDARY = [
  { route: '15X', dest: '紅磡站', dir: 'O' },
  { route: '214', dest: '長沙灣(甘泉街)', dir: 'I' },
  { route: '613', dest: '安泰', dir: 'I' },
  { route: '14H', dest: '順天', dir: 'I' },
  { route: 'A26', dest: '機場', dir: 'O' },
];

// 廣田邨廣靖樓主力
const KWONG_CHING_PRIMARY = [
  { route: '603', dest: '中環(渡輪碼頭)', dir: 'O' },
  { route: '603S', dest: '中環(機利文街)', dir: 'O' },
  { route: '613', dest: '筲箕灣', dir: 'O' },
];

// 廣田邨廣靖樓其他（雙欄顯示：703A 改為正宗 603A）
const KWONG_CHING_SECONDARY = [
  { route: '216M', dest: '油塘站(循環線)', dir: 'O' },
  { route: '214', dest: '油塘', dir: 'O' },
  { route: '88X', dest: '火炭(駿洋邨)', dir: 'O' },
  { route: '14H', dest: '油塘', dir: 'O' },
  { route: '603A', dest: '中環(機利文街)', dir: 'O' },
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
      const matchDir = item.dir ? (i.dir === item.dir) : true;
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
    const secRowH = 68;
    let curY = startY;

    // 分區黑標題
    const titleSvg = `
      <rect x="50" y="${curY}" width="${width}" height="58" rx="10" fill="#000000" />
      <text x="${50 + width / 2}" y="${curY + 41}" font-size="34" font-family="sans-serif" font-weight="bold" fill="#ffffff" text-anchor="middle">${title}</text>
    `;
    curY += 72;

    // 主力常搭路線（單欄 + 3 班次）
    const priSvg = priData.map((item, idx) => {
      const rowTop = curY + idx * priRowH;
      const textY = rowTop + 66;
      const isOdd = idx % 2 === 1;
      const bgRect = isOdd ? `<rect x="50" y="${rowTop}" width="1340" height="${priRowH}" fill="#f4f4f4" />` : '';

      const eta1 = item.etas[0] || '未有班次';
      const eta2 = item.etas[1] || '';
      const eta3 = item.etas[2] || '';

      return `
        ${bgRect}
        <text x="70" y="${textY}" font-size="52" font-family="sans-serif" font-weight="900" fill="#000000">${item.route}</text>
        <text x="260" y="${textY - 3}" font-size="34" font-family="sans-serif" font-weight="bold" fill="#222222">往 ${item.dest}</text>
        
        <line x1="600" y1="${rowTop + 14}" x2="600" y2="${rowTop + priRowH - 14}" stroke="#cccccc" stroke-width="2" />
        <text x="910" y="${textY}" font-size="44" font-family="sans-serif" font-weight="900" text-anchor="end" fill="#000000">${eta1}</text>
        
        <line x1="940" y1="${rowTop + 18}" x2="940" y2="${rowTop + priRowH - 18}" stroke="#e0e0e0" stroke-width="2" />
        <text x="1160" y="${textY}" font-size="32" font-family="sans-serif" fill="#444444" text-anchor="end">${eta2}</text>
        
        <line x1="1180" y1="${rowTop + 18}" x2="1180" y2="${rowTop + priRowH - 18}" stroke="#e0e0e0" stroke-width="2" />
        <text x="1380" y="${textY}" font-size="28" font-family="sans-serif" fill="#777777" text-anchor="end">${eta3}</text>
        <line x1="50" y1="${rowTop + priRowH}" x2="1390" y2="${rowTop + priRowH}" stroke="#e2e2e2" stroke-width="2" />
      `;
    }).join('');

    curY += priData.length * priRowH + 10;

    // 其他路線標籤
    const secTag = `
      <text x="54" y="${curY + 18}" font-size="22" font-family="sans-serif" font-weight="bold" fill="#888888">其他路線</text>
    `;
    curY += 28;

    // 其他路線：雙欄一行兩條線
    let secSvg = '';
    const numRows = Math.ceil(secData.length / 2);

    for (let r = 0; r < numRows; r++) {
      const rowTop = curY + r * secRowH;
      const textY = rowTop + 46;
      const leftItem = secData[r * 2];
      const rightItem = secData[r * 2 + 1];

      // 左欄
      const leftEta = leftItem?.etas[0] || '未有班次';
      const leftCol = leftItem ? `
        <text x="70" y="${textY}" font-size="34" font-family="sans-serif" font-weight="900" fill="#444444">${leftItem.route}</text>
        <text x="210" y="${textY}" font-size="26" font-family="sans-serif" fill="#666666">往 ${leftItem.dest}</text>
        <text x="680" y="${textY}" font-size="32" font-family="sans-serif" font-weight="bold" text-anchor="end" fill="#111111">${leftEta}</text>
      ` : '';

      // 中間縱向分隔線
      const midLine = `<line x1="720" y1="${rowTop + 10}" x2="720" y2="${rowTop + secRowH - 10}" stroke="#e0e0e0" stroke-width="2" />`;

      // 右欄
      const rightEta = rightItem?.etas[0] || (rightItem ? '未有班次' : '');
      const rightCol = rightItem ? `
        <text x="760" y="${textY}" font-size="34" font-family="sans-serif" font-weight="900" fill="#444444">${rightItem.route}</text>
        <text x="900" y="${textY}" font-size="26" font-family="sans-serif" fill="#666666">往 ${rightItem.dest}</text>
        <text x="1370" y="${textY}" font-size="32" font-family="sans-serif" font-weight="bold" text-anchor="end" fill="#111111">${rightEta}</text>
      ` : '';

      const bottomLine = `<line x1="50" y1="${rowTop + secRowH}" x2="1390" y2="${rowTop + secRowH}" stroke="#ebebeb" stroke-width="1.5" stroke-dasharray="6,4" />`;

      secSvg += leftCol + midLine + rightCol + bottomLine;
    }

    return titleSvg + priSvg + secTag + secSvg;
  };

  const svg = `
  <svg width="1440" height="1920" viewBox="0 0 1440 1920" xmlns="http://www.w3.org/2000/svg">
    <rect width="1440" height="1920" fill="#ffffff" />
    
    <!-- 頂部 Header -->
    <g>
      <text x="50" y="125" font-size="60" font-family="sans-serif" font-weight="900" fill="#000000">${fullDateStr}</text>
      ${weatherSvg}
      <text x="800" y="125" font-size="60" font-family="sans-serif" font-weight="900" fill="#000000">${weather.temp}</text>
      <text x="1390" y="125" font-size="60" font-family="sans-serif" font-weight="900" text-anchor="end" fill="#000000">${timeStr}</text>
      <line x1="50" y1="165" x2="1390" y2="165" stroke="#000000" stroke-width="8" />
    </g>

    <!-- 區域一：康栢苑 -->
    ${renderArea('康栢苑', 200, hpPri, hpSec, 195)}

    <!-- 區域二：廣田邨廣靖樓 -->
    ${renderArea('廣田邨廣靖樓', 320, kcPri, kcSec, 1060)}
  </svg>
  `;

  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}
