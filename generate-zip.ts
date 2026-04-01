
import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';

const distPath = path.join(process.cwd(), 'dist');
const zipPath = path.join(distPath, 'RF_Suite_Deploy.zip');

console.log(`Generating deploy zip from ${distPath}...`);

if (!fs.existsSync(distPath)) {
    console.error("Dist folder not found! Run build first.");
    process.exit(1);
}

try {
    const zip = new AdmZip();
    
    // Add all files in dist to the zip
    // Add files individually to avoid adding the zip file itself if it's already in dist
    const files = fs.readdirSync(distPath);
    for (const file of files) {
        if (file === 'RF_Suite_Deploy.zip') continue;
        const filePath = path.join(distPath, file);
        if (fs.lstatSync(filePath).isDirectory()) {
            zip.addLocalFolder(filePath, file);
        } else {
            zip.addLocalFile(filePath);
        }
    }

    zip.writeZip(zipPath);
    
    const stats = fs.statSync(zipPath);
    console.log(`✅ Zip created successfully at ${zipPath}`);
    console.log(`📦 Size: ${(stats.size / 1024).toFixed(2)} KB`);

    // Copy to public folder for direct download access
    const publicPath = path.join(process.cwd(), 'public', 'RF_Suite_Deploy.zip');
    fs.copyFileSync(zipPath, publicPath);
    console.log(`✅ Zip copied to public folder at ${publicPath}`);
    
} catch (err) {
    console.error("❌ Error creating zip:", err);
    process.exit(1);
}
