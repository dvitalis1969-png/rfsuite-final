import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';

async function backupSource() {
    const zip = new AdmZip();
    const rootDir = process.cwd();
    
    const filesToInclude = [
        'App.tsx',
        'server.ts',
        'package.json',
        'vite.config.ts',
        'tsconfig.json',
        'generate-zip.ts',
        'metadata.json',
        'index.html',
        'index.tsx',
        'index.css',
        'types.ts',
        'constants.ts'
    ];
    
    const dirsToInclude = [
        'components',
        'services',
        'utils',
        'constants',
        'public'
    ];

    console.log('Starting source backup...');

    for (const file of filesToInclude) {
        if (fs.existsSync(path.join(rootDir, file))) {
            zip.addLocalFile(path.join(rootDir, file));
        }
    }

    for (const dir of dirsToInclude) {
        if (fs.existsSync(path.join(rootDir, dir))) {
            zip.addLocalFolder(path.join(rootDir, dir), dir);
        }
    }

    const backupPath = path.join(rootDir, 'SOURCE_BACKUP_v2.5.zip');
    zip.writeZip(backupPath);
    
    // Also copy to public so it's downloadable
    const publicBackupPath = path.join(rootDir, 'public', 'SOURCE_BACKUP_v2.5.zip');
    fs.copyFileSync(backupPath, publicBackupPath);

    console.log(`Backup created at ${backupPath} and ${publicBackupPath}`);
}

backupSource().catch(console.error);
