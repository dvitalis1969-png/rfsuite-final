
import fs from 'fs';
import path from 'path';

const zipPath = path.join(process.cwd(), 'dist', 'RF_Suite_Deploy.zip');

if (fs.existsSync(zipPath)) {
    const stats = fs.statSync(zipPath);
    console.log(`File: ${zipPath}`);
    console.log(`Size: ${stats.size} bytes (${(stats.size / 1024).toFixed(2)} KB)`);
} else {
    console.log(`File not found: ${zipPath}`);
}
