import { gridRefToWgs84 } from './src/lib/coordUtils.js';
import { UK_TV_CHANNELS } from './constants.js';

const gridRef = "SJ 368 979";
const coords = gridRefToWgs84(gridRef);
console.log("Coords for SJ 368 979:", coords);

const lat = coords.lat;
const lng = coords.lng;

const winterHill = {
  name: "Winter Hill",
  lat: 53.62536,
  lng: -2.51334,
  erp: 100, // 100 kW
  channels: [32, 34, 35, 31, 37] // Typical channels, let's just pick one or all
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

const distance = haversine(lat, lng, winterHill.lat, winterHill.lng);
console.log("Distance to Winter Hill:", distance, "km");

const erpW = winterHill.erp * 1000;
console.log("ERP (W):", erpW);

// Let's test channel 32
const ch = 32;
const range = UK_TV_CHANNELS[ch];
const f_MHz = range ? (range[0] + range[1]) / 2 : 600;
console.log(`Channel ${ch} Frequency: ${f_MHz} MHz`);

const d_TV_km = Math.max(distance, 0.001);

const sir = 10 
          - 20 * Math.log10(f_MHz) 
          - 20 * Math.log10(0.02) 
          - 10 * Math.log10(erpW) 
          + 20 * Math.log10(d_TV_km) 
          - 44.14;

console.log(`SIR for Channel ${ch}:`, sir);
