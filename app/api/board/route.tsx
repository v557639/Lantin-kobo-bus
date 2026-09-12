import { ImageResponse } from 'next/og';

export const runtime = 'edge';

// 康栢苑 與 廣靖樓 路線清單
const HONG_PAK_ROUTES = ['16', '16X', '216X', '216M', '603'];
const KWONG_CHING_ROUTES = ['603', '603S', '216M', '88X'];

async function getEta(route: string) {
  try {
    const res = await fetch(`https://data.etabus.gov.hk/v1/transport/kmb/route-eta/${route}/1`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      next: { revalidate: 20 }
    });
    const json = await res.json();
    if (!json || !json.data) return { route, dest: '--', etas: ['--'] };

    const now = Date.now();
    // 搵向市區/出九龍/過海方向（過濾有 eta 兼未過期）
    const valid = json.data.filter((i: any) => i.eta && new Date(i.eta).getTime() > now);
    const dest = valid[0]?.dest_tc || json.data[0]?.dest_tc || '目的地';

    const etas = valid.slice(0, 2).map((i: any) => {
      const diff = Math.round((new Date(i.eta).getTime() - now) / 60000);
      return diff <= 0 ? '即到' : `${diff}分`;
    });

    return { route, dest, etas: etas.length > 0 ? etas : ['未有班次'] };
  } catch (e) {
    return { route, dest: '查詢失敗', etas: ['--'] };
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

  // 平行抓取所有資料
  const [hpData, kcData] = await Promise.all([
    Promise.all(HONG_PAK_ROUTES.map(getEta)),
    Promise.all(KWONG_CHING_ROUTES.map(getEta))
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: '1440px',
          height: '1920px',
          backgroundColor: '#ffffff',
          color: '#000000',
          display: 'flex',
          flexDirection: 'column',
          padding: '60px',
        }}
      >
        {/* 頂部時間列 */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            borderBottom: '10px solid #000000',
            paddingBottom: '24px',
            marginBottom: '40px',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '64px', fontWeight: 'bold' }}>藍田交通看板</span>
            <span style={{ fontSize: '28px', color: '#555555', marginTop: '6px' }}>LAM TIN REAL-TIME BUS ETA</span>
          </div>
          <span style={{ fontSize: '80px', fontWeight: 'bold' }}>{timeStr}</span>
        </div>

        {/* 區域一：康栢苑 */}
        <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '50px' }}>
          <div
            style={{
              backgroundColor: '#000000',
              color: '#ffffff',
              padding: '12px 30px',
              fontSize: '36px',
              fontWeight: 'bold',
              borderRadius: '12px',
              width: 'fit-content',
              marginBottom: '20px',
            }}
          >
            康栢苑 (往旺角/尖沙咀/中環/油塘)
          </div>
          {hpData.map((item) => (
            <div
              key={item.route}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '20px 0',
                borderBottom: '3px solid #eeeeee',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '30px' }}>
                <span style={{ width: '180px', fontSize: '56px', fontWeight: 'bold' }}>{item.route}</span>
                <span style={{ fontSize: '38px', color: '#333333' }}>往 {item.dest}</span>
              </div>
              <div style={{ display: 'flex', gap: '24px', alignItems: 'baseline' }}>
                <span style={{ fontSize: '60px', fontWeight: 'bold' }}>{item.etas[0]}</span>
                {item.etas[1] && <span style={{ fontSize: '32px', color: '#777777' }}>下班 {item.etas[1]}</span>}
              </div>
            </div>
          ))}
        </div>

        {/* 區域二：廣靖樓 */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              backgroundColor: '#000000',
              color: '#ffffff',
              padding: '12px 30px',
              fontSize: '36px',
              fontWeight: 'bold',
              borderRadius: '12px',
              width: 'fit-content',
              marginBottom: '20px',
            }}
          >
            廣田邨廣靖樓 (往中環/沙田/油塘)
          </div>
          {kcData.map((item) => (
            <div
              key={item.route}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '20px 0',
                borderBottom: '3px solid #eeeeee',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '30px' }}>
                <span style={{ width: '180px', fontSize: '56px', fontWeight: 'bold' }}>{item.route}</span>
                <span style={{ fontSize: '38px', color: '#333333' }}>往 {item.dest}</span>
              </div>
              <div style={{ display: 'flex', gap: '24px', alignItems: 'baseline' }}>
                <span style={{ fontSize: '60px', fontWeight: 'bold' }}>{item.etas[0]}</span>
                {item.etas[1] && <span style={{ fontSize: '32px', color: '#777777' }}>下班 {item.etas[1]}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
    {
      width: 1440,
      height: 1920,
    }
  );
}
