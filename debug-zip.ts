
import AdmZip from 'adm-zip';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distPath = path.join(process.cwd(), "dist");
console.log("Dist path:", distPath);

if (fs.existsSync(distPath)) {
    console.log("Dist exists");
    const files = fs.readdirSync(distPath);
    console.log("Files in dist:", files);
    
    try {
        const zip = new AdmZip();
        zip.addLocalFolder(distPath);
        const buffer = zip.toBuffer();
        console.log("Zip buffer size:", buffer.length);
        
        // Save it to check
        fs.writeFileSync("test.zip", buffer);
        console.log("Saved test.zip");
    } catch (e) {
        console.error("Zip error:", e);
    }
} else {
    console.log("Dist does not exist");
}
