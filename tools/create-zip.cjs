// create-zip.cjs - Creates a production zip without hanging
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const sourceDir = path.join(process.cwd(), 'dist');
const outputZip = path.join(process.cwd(), 'ERP_Produccion_Final.zip');

// Use Windows built-in PowerShell with timeout
console.log('Creating zip from dist folder...');
console.log('Source:', sourceDir);
console.log('Output:', outputZip);

try {
    // Remove old zip if exists
    if (fs.existsSync(outputZip)) {
        fs.unlinkSync(outputZip);
        console.log('Removed old zip');
    }

    // Use PowerShell with a short-circuit compression (store mode = no compression, faster)
    execFileSync('powershell', [
        '-Command',
        `Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::CreateFromDirectory('${sourceDir}', '${outputZip}', [System.IO.Compression.CompressionLevel]::Fastest, $false)`
    ], { stdio: 'inherit', timeout: 300000 });

    const stat = fs.statSync(outputZip);
    console.log(`\n✅ Done! Zip size: ${(stat.size / 1024 / 1024).toFixed(2)} MB`);
    console.log('File:', outputZip);
} catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
}
