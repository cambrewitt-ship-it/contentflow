const fs = require('fs');
const path = require('path');

// Convert Poppins Bold
const poppinsBoldPath = path.join(__dirname, '../public/fonts/Poppins-Bold.ttf');
const poppinsBoldBuffer = fs.readFileSync(poppinsBoldPath);
const poppinsBoldBase64 = poppinsBoldBuffer.toString('base64');

const poppinsBoldOutput = `
// Auto-generated font file for jsPDF
export const PoppinsBold = '${poppinsBoldBase64}';
`;

const poppinsBoldOutputPath = path.join(__dirname, '../src/app/api/calendar/fonts/Poppins-Bold.js');
fs.mkdirSync(path.dirname(poppinsBoldOutputPath), { recursive: true });
fs.writeFileSync(poppinsBoldOutputPath, poppinsBoldOutput);

console.log('Poppins Bold converted successfully!');
console.log(`Output: ${poppinsBoldOutputPath}`);
console.log(`Size: ${(poppinsBoldBase64.length / 1024).toFixed(2)} KB`);

// Convert Poppins Light
const poppinsLightPath = path.join(__dirname, '../public/fonts/Poppins-Light.ttf');
const poppinsLightBuffer = fs.readFileSync(poppinsLightPath);
const poppinsLightBase64 = poppinsLightBuffer.toString('base64');

const poppinsLightOutput = `
// Auto-generated font file for jsPDF
export const PoppinsLight = '${poppinsLightBase64}';
`;

const poppinsLightOutputPath = path.join(__dirname, '../src/app/api/calendar/fonts/Poppins-Light.js');
fs.mkdirSync(path.dirname(poppinsLightOutputPath), { recursive: true });
fs.writeFileSync(poppinsLightOutputPath, poppinsLightOutput);

console.log('Poppins Light converted successfully!');
console.log(`Output: ${poppinsLightOutputPath}`);
console.log(`Size: ${(poppinsLightBase64.length / 1024).toFixed(2)} KB`);

