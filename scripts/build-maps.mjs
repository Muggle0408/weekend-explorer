/* ============================================================
 * 周末漫游指南 · 离线地图数据管线（方案 A，一次性预处理）
 * 用法：node scripts/build-maps.mjs
 * 1. 从 DataV.GeoAtlas 下载北上广深区级 GeoJSON（含 fallback 到 areas_v2）
 * 2. 计算全市 bbox；Douglas-Peucker 简化 polygon（输出 SVG ≤ 30KB/城）
 * 3. 用与运行时 engine.js 相同的投影逻辑换算到 0-100 坐标系
 * 4. 生成 assets/maps/{bj,sh,gz,sz}.svg（viewBox 0 0 100 100，区级轮廓）
 * 5. 打印每城 bbox，供写入手动维护的 data.js CITY_MAPS
 * ============================================================ */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const CITIES = [
  { id: 'bj', name: '北京', adcode: 110000 },
  { id: 'sh', name: '上海', adcode: 310000 },
  { id: 'gz', name: '广州', adcode: 440100 },
  { id: 'sz', name: '深圳', adcode: 440300 },
];

const SOURCES = [
  'https://geo.datav.aliyun.com/areas_v3/bound/{adcode}_full.json',
  'https://geo.datav.aliyun.com/areas_v2/bound/{adcode}_full.json',
];

/* ---------- 投影：与 engine.js projectToMap 保持一致 ---------- */
function projectToMap(lng, lat, bbox){
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const spanLng = (maxLng - minLng) * Math.cos((minLat + maxLat) / 2 * Math.PI / 180);
  const spanLat = maxLat - minLat;
  const x = (lng - minLng) / (maxLng - minLng) * 100 * (spanLng >= spanLat ? 1 : spanLng / spanLat);
  const y = (1 - (lat - minLat) / (maxLat - minLat)) * 100 * (spanLat >= spanLng ? 1 : spanLat / spanLng);
  return { x: clamp2(x), y: clamp2(y) };
}
function clamp2(v){ return Math.min(100, Math.max(0, Math.round(v * 100) / 100)); }

/* ---------- Douglas-Peucker 简化（手写，零依赖） ---------- */
function simplifyDP(points, tol){
  if(points.length <= 2) return points;
  const [x1, y1] = points[0];
  const [x2, y2] = points[points.length - 1];
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  let maxDist = -1, maxIdx = 0;
  for(let i = 1; i < points.length - 1; i++){
    const [px, py] = points[i];
    let dist;
    if(len === 0) dist = Math.hypot(px - x1, py - y1);
    else dist = Math.abs(dy * px - dx * py + x2 * y1 - y2 * x1) / len;
    if(dist > maxDist){ maxDist = dist; maxIdx = i; }
  }
  if(maxDist <= tol) return [points[0], points[points.length - 1]];
  const left = simplifyDP(points.slice(0, maxIdx + 1), tol);
  const right = simplifyDP(points.slice(maxIdx), tol);
  return left.slice(0, -1).concat(right);
}

/* ---------- GeoJSON 遍历：收集 ring 并计算 bbox ---------- */
function collectRings(geom, rings){
  if(!geom) return;
  if(geom.type === 'Polygon'){
    for(const ring of geom.coordinates) rings.push(ring);
  } else if(geom.type === 'MultiPolygon'){
    for(const poly of geom.coordinates) for(const ring of poly) rings.push(ring);
  }
}

async function fetchGeoJSON(adcode){
  let lastErr = null;
  for(const tpl of SOURCES){
    const url = tpl.replace('{adcode}', adcode);
    try{
      const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
      if(!res.ok) throw new Error(`HTTP ${res.status}`);
      return { geo: await res.json(), url };
    }catch(e){ lastErr = e; }
  }
  throw lastErr || new Error('所有数据源均不可达');
}

function buildCitySVG({ geo }){
  /* 收集全部区划 ring 与全市 bbox */
  const districts = [];
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
  for(const f of geo.features){
    const rings = [];
    collectRings(f.geometry, rings);
    districts.push({ name: f.properties?.name || '', rings });
    for(const ring of rings) for(const [lng, lat] of ring){
      if(lng < minLng) minLng = lng;
      if(lng > maxLng) maxLng = lng;
      if(lat < minLat) minLat = lat;
      if(lat > maxLat) maxLat = lat;
    }
  }
  const bbox = [minLng, minLat, maxLng, maxLat];

  /* 投影空间内 Douglas-Peucker 简化，迭代调整容差使 SVG ≤ 30KB */
  let tol = 0.05;
  let svg = '';
  for(let attempt = 0; attempt < 12; attempt++){
    const paths = districts.map(d => {
      const parts = d.rings.map(ring => {
        const pts = simplifyDP(ring.map(([lng, lat]) => {
          const p = projectToMap(lng, lat, bbox);
          return [p.x, p.y];
        }), tol);
        if(pts.length < 3) return '';
        return 'M' + pts.map(p => p[0] + ',' + p[1]).join('L') + 'Z';
      }).filter(Boolean).join('');
      return parts ? `  <path class="map-district" data-name="${d.name}" d="${parts}"/>` : '';
    }).filter(Boolean).join('\n');
    svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">\n${paths}\n</svg>\n`;
    if(Buffer.byteLength(svg, 'utf8') <= 30 * 1024) break;
    tol *= 1.8;
  }
  return { svg, bbox, tol };
}

const outDir = join(ROOT, 'assets', 'maps');
mkdirSync(outDir, { recursive: true });

const results = [];
for(const c of CITIES){
  process.stdout.write(`[${c.name}] 下载 GeoJSON … `);
  const { geo, url } = await fetchGeoJSON(c.adcode);
  const rawBytes = Buffer.byteLength(JSON.stringify(geo), 'utf8');
  console.log(`OK (${(rawBytes / 1024).toFixed(0)}KB, ${url.split('/areas_')[1]?.split('/')[0] || 'v3'})`);
  const { svg, bbox, tol } = buildCitySVG({ geo });
  const file = join(outDir, `${c.id}.svg`);
  writeFileSync(file, svg, 'utf8');
  const size = Buffer.byteLength(svg, 'utf8');
  console.log(`  → assets/maps/${c.id}.svg ${(size / 1024).toFixed(1)}KB（简化容差 ${tol.toFixed(3)}）`);
  console.log(`  bbox: [${bbox.map(v => v.toFixed(4)).join(', ')}]`);
  results.push({ ...c, bbox, size, rawBytes });
}

console.log('\n/* 以下 bbox 供写入 data.js 的 CITY_MAPS */');
for(const r of results){
  console.log(`${r.id}: { bbox: [${r.bbox.map(v => +v.toFixed(4)).join(', ')}], … } // ${r.name}`);
}
