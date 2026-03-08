const fs = require('fs');
const path = require('path');

const rootDir = process.cwd();
const outputFile = '..\\dpps-codebase.xml';
const excludeDirs = ['node_modules', '.next', '.git', '.vercel', 'dist', 'build', 'public'];
const excludeExts = ['.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.woff', '.woff2', '.ttf', '.eot', '.mp4', '.webm', '.zip', '.tar', '.gz'];

function escapeXml(unsafe) {
    return unsafe.replace(/[<>&'"]/g, function (c) {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '\'': return '&apos;';
            case '"': return '&quot;';
            default: return c;
        }
    });
}

function walkSync(currentDirPath, callback) {
    fs.readdirSync(currentDirPath).forEach(function (name) {
        const filePath = path.join(currentDirPath, name);
        const stat = fs.statSync(filePath);
        if (stat.isFile()) {
            callback(filePath, stat);
        } else if (stat.isDirectory()) {
            if (!excludeDirs.includes(name)) {
                walkSync(filePath, callback);
            }
        }
    });
}

let xmlContent = '<?xml version="1.0" encoding="UTF-8"?>\n<codebase>\n';
let fileCount = 0;

try {
    console.log("Starting code aggregation...");
    walkSync(rootDir, function (filePath, stat) {
        const ext = path.extname(filePath).toLowerCase();
        if (excludeExts.includes(ext)) return;

        // Skip the output file itself and the script
        if (filePath.endsWith('dpps-codebase.xml') || filePath.endsWith('generate-xml.js')) return;
        if (filePath.includes('package-lock.json')) return;

        const relativePath = path.relative(rootDir, filePath);
        try {
            const fileContent = fs.readFileSync(filePath, 'utf8');
            if (fileContent.indexOf('\0') !== -1) return; // Unlikely to be text

            xmlContent += `  <file path="${escapeXml(relativePath)}">\n`;
            xmlContent += `    <content>\n${escapeXml(fileContent)}\n    </content>\n`;
            xmlContent += `  </file>\n`;
            fileCount++;
        } catch (err) {
            console.error(`Could not read file ${relativePath}:`, err.message);
        }
    });

    xmlContent += '</codebase>\n';
    fs.writeFileSync(path.join(rootDir, outputFile), xmlContent);
    console.log(`Successfully created XML containing ${fileCount} files at ${path.resolve(rootDir, outputFile)}`);
} catch (err) {
    console.error("Error creating XML:", err);
}
