
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
    // Instead of manual iteration which can be buggy with adm-zip, add the whole folder content
    zip.addLocalFolder(distPath);

    // Remove any existing zip files from inside the zip to avoid recursion
    zip.getEntries().forEach(entry => {
        if (entry.entryName.endsWith('.zip')) {
            zip.deleteFile(entry);
        }
    });

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
