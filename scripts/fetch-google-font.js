const https = require('https');
const fs = require('fs');
const path = require('path');

// Google Fonts API provides direct TTF download
const fontName = 'Noto+Sans';
const variant = '400';
const fontUrl = `https://fonts.googleapis.com/css2?family=${fontName}:wght@${variant}&display=swap`;

console.log('Fetching font CSS to find TTF URL...');

https.get(fontUrl, (response) => {
  let data = '';
  response.on('data', chunk => data += chunk);
  response.on('end', () => {
    // Parse CSS to find TTF URL
    const ttfMatch = data.match(/url\(([^)]+\.ttf[^)]*)\)/);
    if (ttfMatch) {
      const ttfUrl = ttfMatch[1].replace(/\\/g, '').replace(/['"]/g, '');
      console.log('Found TTF URL:', ttfUrl);
      downloadTTF(ttfUrl);
    } else {
      console.log('Could not find TTF URL in CSS. CSS content:');
      console.log(data.substring(0, 500));
      console.log('\nTrying alternative method...');
      // Try direct download
      const directUrl = 'https://fonts.gstatic.com/s/notosans/v36/o-0IIpQlx3QUlC5A4PNr5TRASf6M7Q.ttf';
      downloadTTF(directUrl);
    }
  });
}).on('error', err => {
  console.error('Error fetching CSS:', err.message);
});

function downloadTTF(url) {
  const outputPath = path.join(__dirname, '../public/fonts/NotoSans-Regular.ttf');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const file = fs.createWriteStream(outputPath);
  
  console.log('Downloading TTF from:', url);
  
  https.get(url, (response) => {
    if (response.statusCode === 200) {
      response.pipe(file);
      response.on('end', () => {
        file.close();
        const stats = fs.statSync(outputPath);
        console.log(`✓ Downloaded ${(stats.size / 1024).toFixed(2)} KB`);
        if (stats.size > 100000) {
          console.log('✓ Font file appears valid!');
          console.log('Now converting to jsPDF format...');
          require('./convert-font.js');
        } else {
          console.log('✗ Font file too small, may be corrupted');
        }
      });
    } else {
      console.error('Download failed with status:', response.statusCode);
    }
  }).on('error', err => {
    console.error('Download error:', err.message);
  });
}

