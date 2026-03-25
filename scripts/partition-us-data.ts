import fs from 'fs';
import path from 'path';

const transmitters = JSON.parse(fs.readFileSync('data/us_transmitters.json', 'utf8'));

const grid: Record<string, any[]> = {};

transmitters.forEach((t: any) => {
    const latGrid = Math.floor(t.lat / 2);
    const lngGrid = Math.floor(t.lng / 2);
    const key = `${latGrid}_${lngGrid}`;
    if (!grid[key]) grid[key] = [];
    grid[key].push(t);
});

if (!fs.existsSync('data/us_partitioned')) fs.mkdirSync('data/us_partitioned');

for (const key in grid) {
    fs.writeFileSync(`data/us_partitioned/${key}.json`, JSON.stringify(grid[key]));
}
console.log('Partitioning complete');
