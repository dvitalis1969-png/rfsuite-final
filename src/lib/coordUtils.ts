import proj4 from 'proj4';

// OSGB36 / British National Grid (EPSG:27700)
const OSGB36 = "+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 +x_0=400000 +y_0=-100000 +ellps=airy +datum=OSGB36 +units=m +no_defs";
// WGS84 (EPSG:4326)
const WGS84 = "+proj=longlat +datum=WGS84 +no_defs";

/**
 * Converts OSGB36 Eastings and Northings to WGS84 Latitude and Longitude.
 */
export function osgbToWgs84(eastings: number, northings: number): { lat: number; lng: number } {
  const [lng, lat] = proj4(OSGB36, WGS84, [eastings, northings]);
  return { lat, lng };
}

/**
 * Converts a UK National Grid Reference (e.g., "TQ 300 800" or "TQ300800") to WGS84 coordinates.
 * Supports 4, 6, 8, or 10 figure grid references.
 */
export function gridRefToWgs84(gridRef: string): { lat: number; lng: number } | null {
  const cleaned = gridRef.replace(/\s+/g, '').toUpperCase();
  const match = cleaned.match(/^([A-Z]{2})(\d+)$/);
  
  if (!match) return null;
  
  const letters = match[1];
  const numbers = match[2];
  
  if (numbers.length % 2 !== 0) return null;
  
  const halfLen = numbers.length / 2;
  const eStr = numbers.substring(0, halfLen);
  const nStr = numbers.substring(halfLen);
  
  const l1 = letters.charAt(0);
  const l2 = letters.charAt(1);
  
  const getVal = (c: string) => {
    let v = c.charCodeAt(0) - 'A'.charCodeAt(0);
    if (v > 8) v--; // Skip I
    return v;
  };
  
  const v1 = getVal(l1);
  const v2 = getVal(l2);
  
  // 500km square origin
  const e5 = ((v1 % 5) - 2) * 500000;
  const n5 = (3 - Math.floor(v1 / 5)) * 500000;
  
  // 100km square origin
  const e1 = (v2 % 5) * 100000;
  const n1 = (4 - Math.floor(v2 / 5)) * 100000;
  
  // Adjust for 6 figures (3 each) -> 100m precision
  const multiplier = Math.pow(10, 5 - halfLen);
  const eastings = e5 + e1 + parseInt(eStr) * multiplier;
  const northings = n5 + n1 + parseInt(nStr) * multiplier;

  return osgbToWgs84(eastings, northings);
}
