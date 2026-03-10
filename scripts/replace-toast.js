const fs = require('fs');
const path = require('path');

const directoryPath = path.join(__dirname, '../src');

function findAndReplace(dir) {
    fs.readdirSync(dir).forEach(file => {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            findAndReplace(fullPath);
        } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            if (content.includes("from 'sonner'") || content.includes('from "sonner"')) {
                // Ensure we do not replace inside our custom wrapper
                if (fullPath.includes('toast.tsx') || fullPath.includes('error-handler.tsx') || fullPath.includes('layout.tsx')) return;

                content = content.replace(/import\s+{\s*toast\s*}\s+from\s+['"]sonner['"];?/g, 'import { toast } from "@/lib/toast";');
                fs.writeFileSync(fullPath, content, 'utf8');
            }
        }
    });
}

findAndReplace(directoryPath);
console.log('Successfully replaced global imports.');
