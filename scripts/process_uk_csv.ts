import fs from 'fs';
import path from 'path';
import proj4 from 'proj4';

// OSGB36 / British National Grid (EPSG:27700)
const OSGB36 = "+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 +x_0=400000 +y_0=-100000 +ellps=airy +datum=OSGB36 +units=m +no_defs";
// WGS84 (EPSG:4326)
const WGS84 = "+proj=longlat +datum=WGS84 +no_defs";

function osgbToWgs84(eastings: number, northings: number): { lat: number; lng: number } {
  const [lng, lat] = proj4(OSGB36, WGS84, [eastings, northings]);
  return { lat, lng };
}

function calculateRadius(erpKw: number): number {
  if (erpKw >= 100) return 120;
  if (erpKw >= 10) return 80;
  if (erpKw >= 1) return 40;
  if (erpKw >= 0.1) return 20;
  if (erpKw >= 0.01) return 10;
  return 5;
}

async function run() {
  const csvPath = path.join(process.cwd(), 'data', 'uk_transmitters.csv');
  if (!fs.existsSync(csvPath)) {
    console.error("CSV file not found");
    return;
  }

  const content = fs.readFileSync(csvPath, 'utf8');
  const lines = content.split('\n');
  const headers = lines[0].split(',');

  const results = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Handle quoted commas if necessary, but this CSV looks simple
    const parts = line.split(',');
    if (parts.length < 29) continue;

    const name = parts[0].trim();
    const easting = parseInt(parts[4]);
    const northing = parseInt(parts[5]);

    if (isNaN(easting) || isNaN(northing)) continue;

    const { lat, lng } = osgbToWgs84(easting, northing);

    const channels = [];
    const erps = [];

    // PSB1: 13, 15
    // PSB2: 16, 18
    // PSB3: 19, 21
    // COM4: 22, 24
    // COM5: 25, 27
    // COM6: 28, 30
    
    const channelIndices = [13, 16, 19, 22, 25, 28];
    const erpIndices = [15, 18, 21, 24, 27, 30];

    for (let j = 0; j < channelIndices.length; j++) {
      const ch = parseInt(parts[channelIndices[j]]);
      const erp = parseFloat(parts[erpIndices[j]]);
      if (!isNaN(ch)) channels.push(ch);
      if (!isNaN(erp)) erps.push(erp);
    }

    if (channels.length === 0) continue;

    const maxErp = erps.length > 0 ? Math.max(...erps) : 0;
    const radius = calculateRadius(maxErp);

    results.push({
      name,
      lat,
      lng,
      radius,
      erp: maxErp,
      channels: Array.from(new Set(channels)).sort((a, b) => a - b)
    });
  }

  fs.writeFileSync(
    path.join(process.cwd(), 'data', 'uk_transmitters.json'),
    JSON.stringify(results, null, 2)
  );

  console.log(`Processed ${results.length} transmitters.`);
}

run();
