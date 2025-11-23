# Adding Emoji Support to PDF Export

## Overview
jsPDF has limited native support for emojis. To add emoji support, you need to embed a custom font that includes emoji glyphs.

## Challenges
1. **Font Size**: Emoji fonts are very large (10MB+)
2. **Monochrome Only**: PDFs render emojis as black/white glyphs, not colored
3. **Font Conversion**: TTF fonts need to be converted to jsPDF format

## Option 1: Noto Color Emoji (Full Support)
This provides the most comprehensive emoji support but is very large.

### Steps:
1. Download Noto Color Emoji TTF:
   ```bash
   curl -L "https://github.com/google/fonts/raw/main/ofl/notoemoji/NotoEmoji-Regular.ttf" -o public/fonts/NotoEmoji-Regular.ttf
   ```

2. Convert to jsPDF format using our script:
   ```bash
   node scripts/convert-font.js
   ```

3. Update the route to use the font (already have this code)

### Limitations:
- File size: ~10MB (increases PDF size significantly)
- Slow loading/processing
- Still renders as monochrome in PDFs

## Option 2: Noto Sans with Unicode Support (Partial)
Noto Sans Regular supports many Unicode characters including some emojis.

### Steps:
1. Ensure `public/fonts/NotoSans-Regular.ttf` exists
2. Run conversion script:
   ```bash
   node scripts/convert-font.js
   ```
3. The font file should be generated at `src/app/api/calendar/fonts/NotoSans-Regular.js`

### Limitations:
- Limited emoji coverage
- Only common/simple emojis will render
- Better than nothing but not comprehensive

## Option 3: Render Emojis as Images (Alternative)
Instead of using fonts, convert emojis to images and embed them.

### Implementation Approach:
1. Detect emoji characters in text
2. Use canvas API to render emoji to image
3. Embed image in PDF at emoji position

This is complex but gives best control over emoji appearance.

## Recommendation

**For most use cases**: Keep the current approach (removing emojis with `cleanTextForPDF`)

**If emoji support is critical**: 
1. Use Noto Sans Regular (already set up, just needs proper conversion)
2. Accept that complex emojis may not render
3. Consider the image-based approach for full support

## Current Status
- Font conversion script exists: `scripts/convert-font.js`
- Font TTF file exists: `public/fonts/NotoSans-Regular.ttf`  
- Font JS file location: `src/app/api/calendar/fonts/NotoSans-Regular.js` (currently corrupted)
- Route code is ready to use fonts when available

## Next Steps to Enable
1. Fix the corrupted font file
2. Re-run conversion script
3. Uncomment font import in route.ts
4. Test with emoji-containing text

