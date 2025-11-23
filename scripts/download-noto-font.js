const https = require('https');
const fs = require('fs');
const path = require('path');

const fontUrl = 'https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSans/NotoSans-Regular.ttf';
const outputPath = path.join(__dirname, '../public/fonts/NotoSans-Regular.ttf');

console.log('Downloading Noto Sans Regular font...');
console.log('URL:', fontUrl);
console.log('Output:', outputPath);

// Ensure directory exists
fs.mkdirSync(path.dirname(outputPath), { recursive: true });

const file = fs.createWriteStream(outputPath);

https.get(fontUrl, (response) => {
  if (response.statusCode === 302 || response.statusCode === 301) {
    // Follow redirect
    https.get(response.headers.location, (redirectResponse) => {
      redirectResponse.pipe(file);
      redirectResponse.on('end', () => {
        file.close();
        const stats = fs.statSync(outputPath);
        console.log(`✓ Downloaded ${(stats.size / 1024).toFixed(2)} KB`);
        if (stats.size > 100000) {
          console.log('✓ Font file appears valid, now converting...');
          require('./convert-font.js');
        } else {
          console.log('✗ Font file too small, may be corrupted');
        }
      });
    });
  } else {
    response.pipe(file);
    response.on('end', () => {
      file.close();
      const stats = fs.statSync(outputPath);
      console.log(`✓ Downloaded ${(stats.size / 1024).toFixed(2)} KB`);
      if (stats.size > 100000) {
        console.log('✓ Font file appears valid, now converting...');
        require('./convert-font.js');
      } else {
        console.log('✗ Font file too small, may be corrupted');
      }
    });
  }
}).on('error', (err) => {
  console.error('✗ Download failed:', err.message);
  console.log('\nPlease manually download Noto Sans Regular from:');
  console.log('https://fonts.google.com/specimen/Noto+Sans');
  console.log('Place it at:', outputPath);
});

