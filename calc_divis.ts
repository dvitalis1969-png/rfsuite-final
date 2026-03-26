import { gridRefToWgs84 } from './src/lib/coordUtils.js';
import { UK_TV_CHANNELS } from './constants.js';

const gridRef = "NW 050 996";
const coords = gridRefToWgs84(gridRef);
console.log(`Coords for ${gridRef}:`, coords);

const lat = coords.lat;
const lng = coords.lng;

const divis = {
  name: "Divis",
  lat: 54.6074,
  lng: -6.00833,
  erp: 100, // 100 kW
  channels: [21, 23, 24, 26, 27, 30]
};

const haversine = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

const distance = haversine(lat, lng, divis.lat, divis.lng);
console.log("Distance to Divis:", distance, "km");

// Let's test channel 21 (100kW) and 23 (50kW override)
[21, 23].forEach(ch => {
  let erpKw = divis.erp;
  if (ch === 23) erpKw = 50; // Override
  
  const erpW = erpKw * 1000;
  const range = UK_TV_CHANNELS[ch];
  const f_MHz = range ? (range[0] + range[1]) / 2 : 600;
  
  const d_TV_km = Math.max(distance, 0.001);

  const sir = 10 
            - 20 * Math.log10(f_MHz) 
            - 20 * Math.log10(0.02) 
            - 10 * Math.log10(erpW) 
            + 20 * Math.log10(d_TV_km) 
            - 44.14;

  console.log(`\nChannel ${ch} Frequency: ${f_MHz} MHz, ERP: ${erpKw}kW`);
  console.log(`SIR for Channel ${ch}:`, sir);
});
