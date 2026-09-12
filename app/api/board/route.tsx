import { ImageResponse } from '@vercel/og';

export const runtime = 'edge';

// 定義你要睇嘅兩組路線清單
const STATIONS = {
  hongPak: {
    name: '康栢苑 (往旺角/尖沙咀/中環/油塘)',
    routes: ['16', '16X', '216X', '216M', '603']
  },
  kwongChing: {
    name: '廣田邨廣靖樓 (往中環/沙田/油塘)',
    routes: ['603', '603S', '216M', '88X']
  }
};

async function getEta(route: string) {
  try {
    const res = await fetch(`https://data.etabus.gov.hk/v1/transport/kmb/route-eta/${route}/1`, {
      next: { revalidate: 30 }
    });
    const json = await res.json();
    if (!json.data) return [];
    
    // 搵第一同第二班最快到站時間（過濾有效時間）
    const now = new Date().getTime();
    return json.data
      .filter((item: any) => item.eta && new Date(item.eta).getTime() > now)
      .slice(0, 2)
      .map((item: any) => {
        const diffMins = Math.round((new Date(item.eta).getTime() - now) / 60000);
        return {
          dest: item.dest_tc,
          mins: diffMins <= 0 ? '即將抵達' : `${diffMins} 分鐘`
        };
      });
  } catch (e) {
    return [];
  }
}

export async function GET() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('zh-HK', { timeZone: 'Asia/Hong_Kong', hour12: false, hour: '2-digit', minute: '2-digit' });

  // 抓取康栢苑同廣靖樓需要嘅路線資料
  const hpData = await Promise.all(
    STATIONS.hongPak.routes.map(async (r) => ({ route: r, etas: await getEta(r) }))
  );
  const kcData = await Promise.all(
    STATIONS.kwongChing.routes.map(async (r) => ({ route: r, etas: await getEta(r) }))
  );

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
          fontFamily: 'sans-serif',
        }}
      >
        {/* 頂部 Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '8px solid #000', paddingBottom: '20px', marginBottom: '40px' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '64px', fontWeight: '900' }}>藍田交通實時到站</span>
            <span style={{ fontSize: '28px', color: '#555', marginTop: '8px' }}>康栢苑 · 廣靖樓 出門看板</span>
          </div>
          <span style={{ fontSize: '72px', fontWeight: '900' }}>{timeStr}</span>
        </div>

        {/* 區域一：康栢苑 */}
        <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '50px' }}>
          <div style={{ backgroundColor: '#000', color: '#fff', padding: '12px 24px', fontSize: '36px', fontWeight: 'bold', borderRadius: '8px', width: 'fit-content', marginBottom: '20px' }}>
            {STATIONS.hongPak.name}
          </div>
          {hpData.map((item) => (
            <div key={item.route} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 0', borderBottom: '2px solid #ddd' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '30px' }}>
                <span style={{ width: '180px', fontSize: '52px', fontWeight: '900' }}>{item.route}</span>
                <span style={{ fontSize: '38px', color: '#333' }}>{item.etas[0]?.dest || '往 市區/接駁'}</span>
              </div>
              <div style={{ display: 'flex', gap: '20px', alignItems: 'baseline' }}>
                <span style={{ fontSize: '56px', fontWeight: '900' }}>{item.etas[0]?.mins || '--'}</span>
                {item.etas[1] && <span style={{ fontSize: '32px', color: '#666' }}>下班 {item.etas[1].mins}</span>}
              </div>
            </div>
          ))}
        </div>

        {/* 區域二：廣靖樓 */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ backgroundColor: '#000', color: '#fff', padding: '12px 24px', fontSize: '36px', fontWeight: 'bold', borderRadius: '8px', width: 'fit-content', marginBottom: '20px' }}>
            {STATIONS.kwongChing.name}
          </div>
          {kcData.map((item) => (
            <div key={item.route} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 0', borderBottom: '2px solid #ddd' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '30px' }}>
                <span style={{ width: '180px', fontSize: '52px', fontWeight: '900' }}>{item.route}</span>
                <span style={{ fontSize: '38px', color: '#333' }}>{item.etas[0]?.dest || '往 市區/新界'}</span>
              </div>
              <div style={{ display: 'flex', gap: '20px', alignItems: 'baseline' }}>
                <span style={{ fontSize: '56px', fontWeight: '900' }}>{item.etas[0]?.mins || '--'}</span>
                {item.etas[1] && <span style={{ fontSize: '32px', color: '#666' }}>下班 {item.etas[1].mins}</span>}
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
