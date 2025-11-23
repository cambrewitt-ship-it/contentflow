const fs = require('fs');
const path = require('path');

// Read the font file
const fontPath = path.join(__dirname, '../public/fonts/NotoSans-Regular.ttf');
const fontBuffer = fs.readFileSync(fontPath);
const fontBase64 = fontBuffer.toString('base64');

// Generate the jsPDF font file
const output = `
// Auto-generated font file for jsPDF
export const NotoSansRegular = '${fontBase64}';
`;

// Write to fonts directory
const outputPath = path.join(__dirname, '../src/app/api/calendar/fonts/NotoSans-Regular.js');
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, output);

console.log('Font converted successfully!');
console.log(`Output: ${outputPath}`);
console.log(`Size: ${(fontBase64.length / 1024).toFixed(2)} KB`);

