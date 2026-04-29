import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { jsPDF } from 'jspdf';
import sizeOf from 'image-size';
import { readFileSync } from 'fs';
import { join } from 'path';
import { resolvePortalToken } from '@/lib/portalAuth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_SUPABASE_SERVICE_ROLE!
);

function loadFont(fontFileName: string): string {
  const fontPath = join(process.cwd(), 'src', 'app', 'api', 'calendar', 'fonts', fontFileName);
  const fontContent = readFileSync(fontPath, 'utf-8');
  const match = fontContent.match(/export const \w+\s*=\s*'([^']+)';/s);
  if (match && match[1]) return match[1];
  throw new Error(`Could not extract font data from ${fontFileName}`);
}

async function fetchImageAsBase64(imageUrl: string): Promise<string | null> {
  try {
    if (imageUrl.startsWith('data:image')) return imageUrl;
    if (imageUrl.startsWith('http')) {
      const response = await fetch(imageUrl);
      if (!response.ok) return null;
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const base64 = buffer.toString('base64');
      let mimeType = 'image/jpeg';
      if (imageUrl.toLowerCase().endsWith('.png')) mimeType = 'image/png';
      else if (imageUrl.toLowerCase().endsWith('.webp')) mimeType = 'image/webp';
      return `data:${mimeType};base64,${base64}`;
    }
    return null;
  } catch {
    return null;
  }
}

async function getImageDimensions(base64: string): Promise<{ width: number; height: number }> {
  try {
    const base64Data = base64.split(',')[1] || base64;
    const buffer = Buffer.from(base64Data, 'base64');
    const dimensions = sizeOf(buffer);
    if (dimensions.width && dimensions.height) return { width: dimensions.width, height: dimensions.height };
    return { width: 1080, height: 1080 };
  } catch {
    return { width: 1080, height: 1080 };
  }
}

function hasEmojiOrUnicode(text: string): boolean {
  return /[^\x00-\x7F]/.test(text);
}

function cleanTextForPDF(text: string): string {
  return text.replace(/[\uFFFD]/g, '').trim();
}

function formatPostDate(dateString: string): string {
  if (!dateString || dateString === 'No Date') return 'No Date';
  try {
    const date = new Date(dateString);
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dayName = dayNames[date.getDay()];
    const day = date.getDate();
    const month = monthNames[date.getMonth()];
    let suffix = 'th';
    if (day === 1 || day === 21 || day === 31) suffix = 'st';
    else if (day === 2 || day === 22) suffix = 'nd';
    else if (day === 3 || day === 23) suffix = 'rd';
    return `${dayName} ${day}${suffix} ${month}`;
  } catch {
    return dateString;
  }
}

function formatTime(timeString: string): string {
  if (!timeString) return '';
  const parts = timeString.split(':');
  const hours = parseInt(parts[0]);
  const minutes = parts[1] || '00';
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}

interface LogoData { base64: string; dims: { width: number; height: number }; format: 'JPEG' | 'PNG' | 'WEBP' }

function addHeaderWithLogos(doc: jsPDF, pageWidth: number, clientLogo: LogoData | null, pdfTitle: string, clientName: string): number {
  const logoMaxHeight = 20;
  const logoTopMargin = 5;
  const logoSideMargin = 15;

  if (clientLogo) {
    try {
      const aspectRatio = clientLogo.dims.width / clientLogo.dims.height;
      let w = logoMaxHeight * aspectRatio;
      let h = logoMaxHeight;
      if (w > pageWidth / 2 - logoSideMargin) { w = pageWidth / 2 - logoSideMargin; h = w / aspectRatio; }
      doc.addImage(clientLogo.base64, clientLogo.format, logoSideMargin, logoTopMargin, w, h);
    } catch { /* skip logo on error */ }
  }

  const logoCenterY = logoTopMargin + logoMaxHeight / 2;
  doc.setFontSize(24);
  doc.setFont('Poppins', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(pdfTitle, pageWidth / 2, logoCenterY - 2, { align: 'center' });
  doc.setFontSize(16);
  doc.setFont('PoppinsLight', 'normal');
  doc.text(clientName, pageWidth / 2, logoCenterY + 6, { align: 'center' });

  const separatorY = Math.max(logoTopMargin + logoMaxHeight, logoCenterY + 6) + 10;
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.line(logoSideMargin, separatorY, pageWidth - logoSideMargin, separatorY);
  return separatorY + 10;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, postIds, pdfTitle = 'Content Calendar', pdfFileName } = body;

    if (!token) return NextResponse.json({ error: 'Token is required' }, { status: 401 });
    if (!postIds || !Array.isArray(postIds) || postIds.length === 0) {
      return NextResponse.json({ error: 'Post IDs are required' }, { status: 400 });
    }

    const resolved = await resolvePortalToken(token);
    if (!resolved) return NextResponse.json({ error: 'Invalid portal token' }, { status: 401 });
    const { clientId } = resolved;

    const { data: client } = await supabase.from('clients').select('name, logo_url').eq('id', clientId).single();
    const clientName = client?.name || '';
    const clientLogoUrl = client?.logo_url || null;

    const { data: posts, error: postsError } = await supabase
      .from('calendar_scheduled_posts')
      .select('id, caption, image_url, platforms_scheduled, scheduled_date, scheduled_time')
      .in('id', postIds)
      .eq('client_id', clientId)
      .order('scheduled_date', { ascending: true })
      .order('scheduled_time', { ascending: true });

    if (postsError) {
      console.error('Portal PDF export - posts query error:', postsError);
      return NextResponse.json({ error: 'Failed to fetch posts' }, { status: 500 });
    }

    if (!posts || posts.length === 0) {
      return NextResponse.json({ error: 'Posts not found' }, { status: 404 });
    }

    const fetchLogoData = async (url: string | null): Promise<LogoData | null> => {
      if (!url) return null;
      const base64 = await fetchImageAsBase64(url);
      if (!base64) return null;
      const dims = await getImageDimensions(base64);
      let format: 'JPEG' | 'PNG' | 'WEBP' = 'JPEG';
      if (base64.includes('image/png')) format = 'PNG';
      else if (base64.includes('image/webp')) format = 'WEBP';
      return { base64, dims, format };
    };

    const imageUrls = posts.map(p => p.image_url as string | null);
    const [clientLogo, ...postImageBase64s] = await Promise.all([
      fetchLogoData(clientLogoUrl),
      ...imageUrls.map(url => url ? fetchImageAsBase64(url) : Promise.resolve(null)),
    ]);

    const postImageMap = new Map<string, string | null>();
    posts.forEach((post, i) => postImageMap.set(post.id, postImageBase64s[i] ?? null));

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    const NotoSansRegular = loadFont('NotoSans-Regular.js');
    doc.addFileToVFS('NotoSans-Regular.ttf', NotoSansRegular);
    doc.addFont('NotoSans-Regular.ttf', 'NotoSans', 'normal');

    const PoppinsBold = loadFont('Poppins-Bold.js');
    doc.addFileToVFS('Poppins-Bold.ttf', PoppinsBold);
    doc.addFont('Poppins-Bold.ttf', 'Poppins', 'bold');

    const PoppinsLight = loadFont('Poppins-Light.js');
    doc.addFileToVFS('Poppins-Light.ttf', PoppinsLight);
    doc.addFont('Poppins-Light.ttf', 'PoppinsLight', 'normal');

    doc.setFont('helvetica', 'normal');

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const headerHeight = addHeaderWithLogos(doc, pageWidth, clientLogo, pdfTitle, clientName);

    const columnGap = 10;
    const columnWidth = 75;
    const startX = pageWidth / 2 - 1.5 * columnWidth - columnGap;
    const maxImageWidth = columnWidth - 4;
    const maxImageHeight = 110;

    let yPosition = headerHeight;
    let currentColumn = 0;
    let rowStartY = yPosition;
    let rowMaxHeight = 0;
    let pageStartHeaderY = headerHeight;
    let estimatedPostHeight = 100;
    let currentPostIndex = 0;
    const totalPosts = posts.length;

    const calculateCenteredY = (headerY: number, contentHeight: number) => {
      const available = pageHeight - headerY - 15;
      return headerY + (available - contentHeight) / 2;
    };

    for (const post of posts) {
      currentPostIndex++;

      if (currentColumn >= 3) {
        doc.addPage();
        const newH = addHeaderWithLogos(doc, pageWidth, clientLogo, pdfTitle, clientName);
        pageStartHeaderY = newH;
        rowStartY = newH;
        yPosition = rowStartY;
        rowMaxHeight = 0;
        currentColumn = 0;
      }

      if (currentColumn === 0 && yPosition > pageHeight - 40) {
        doc.addPage();
        const newH = addHeaderWithLogos(doc, pageWidth, clientLogo, pdfTitle, clientName);
        pageStartHeaderY = newH;
        rowStartY = newH;
        yPosition = rowStartY;
        currentColumn = 0;
        rowMaxHeight = 0;
      }

      if (currentColumn === 0) {
        const centeredY = calculateCenteredY(pageStartHeaderY, estimatedPostHeight);
        rowStartY = Math.max(pageStartHeaderY + 5, centeredY - 15);
        yPosition = rowStartY;
      }

      let columnX: number;
      if (currentColumn === 0) columnX = startX;
      else if (currentColumn === 1) columnX = startX + columnWidth + columnGap;
      else columnX = startX + 2 * columnWidth + 2 * columnGap;

      const startY = rowStartY;
      const columnCenterX = columnX + columnWidth / 2;
      const imageY = startY + 5;
      const effectiveMaxImageWidth = Math.min(maxImageWidth, columnWidth - 4);

      let imageAdded = false;
      let actualImageWidth = effectiveMaxImageWidth;
      let actualImageHeight = effectiveMaxImageWidth;
      let imageX = columnCenterX - effectiveMaxImageWidth / 2;

      const postDateText = formatPostDate(post.scheduled_date || 'No Date');
      const postTimeText = post.scheduled_time ? formatTime(post.scheduled_time) : '';
      const dateTimeText = postTimeText ? `${postDateText} ${postTimeText}` : postDateText;

      if (post.image_url) {
        try {
          const imageBase64 = postImageMap.get(post.id) ?? null;
          if (imageBase64) {
            const imageDimensions = await getImageDimensions(imageBase64);
            const aspectRatio = imageDimensions.width / imageDimensions.height;
            if (aspectRatio > 1) {
              actualImageWidth = effectiveMaxImageWidth;
              actualImageHeight = effectiveMaxImageWidth / aspectRatio;
            } else if (aspectRatio < 1) {
              actualImageHeight = Math.min(maxImageHeight, effectiveMaxImageWidth / aspectRatio);
              actualImageWidth = actualImageHeight * aspectRatio;
            } else {
              actualImageWidth = effectiveMaxImageWidth;
              actualImageHeight = effectiveMaxImageWidth;
            }
            imageX = columnCenterX - actualImageWidth / 2;
            let format: 'JPEG' | 'PNG' | 'WEBP' = 'JPEG';
            if (imageBase64.includes('image/png')) format = 'PNG';
            else if (imageBase64.includes('image/webp')) format = 'WEBP';

            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(0, 0, 0);
            doc.text(dateTimeText, columnCenterX, startY, { align: 'center' });
            doc.addImage(imageBase64, format, imageX, imageY, actualImageWidth, actualImageHeight);
            imageAdded = true;
          }
        } catch {
          doc.setFontSize(12);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(0, 0, 0);
          doc.text(dateTimeText, columnCenterX, startY, { align: 'center' });
          doc.setFillColor(240, 240, 240);
          doc.rect(imageX, imageY, actualImageWidth, actualImageHeight, 'F');
        }
      }

      if (!imageAdded) {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text(dateTimeText, columnCenterX, startY, { align: 'center' });
        doc.setFillColor(240, 240, 240);
        doc.rect(imageX, imageY, actualImageWidth, actualImageHeight, 'F');
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text('No Image', columnCenterX, imageY + actualImageHeight / 2, { align: 'center' });
      }

      const textX = imageX;
      const textWidth = actualImageWidth;
      let textY = imageY + actualImageHeight + 4;

      const platformText = Array.isArray(post.platforms_scheduled) && post.platforms_scheduled.length > 0
        ? post.platforms_scheduled.join(', ')
        : null;
      if (platformText) {
        const cleanPlatform = cleanTextForPDF(platformText);
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        if (hasEmojiOrUnicode(cleanPlatform)) doc.setFont('NotoSans', 'bold');
        else doc.setFont('helvetica', 'bold');
        doc.text(cleanPlatform, textX, textY + 4);
        textY += 6;
      }

      const rawCaption = post.caption || 'No caption';
      const captionText = cleanTextForPDF(rawCaption) || 'No caption';
      doc.setTextColor(60, 60, 60);
      if (hasEmojiOrUnicode(captionText)) doc.setFont('NotoSans', 'normal');
      else doc.setFont('helvetica', 'normal');

      let captionFontSize = 12;
      const excess = captionText.length - 150;
      if (excess > 0) {
        if (excess <= 100) captionFontSize = 12 - (excess / 100) * 2;
        else if (excess <= 200) captionFontSize = 10 - ((excess - 100) / 100) * 1.5;
        else captionFontSize = 8.5 - Math.min((excess - 200) / 150, 1) * 1.5;
        captionFontSize = Math.max(captionFontSize, 7);
      }
      doc.setFontSize(captionFontSize);

      const captionLines = doc.splitTextToSize(captionText, textWidth);
      const lineHeight = captionFontSize * 0.35;
      doc.text(captionLines, textX, textY + 4);
      textY += captionLines.length * lineHeight + 2;

      const boxHeight = Math.max(actualImageHeight + 10, textY - startY + 5);
      rowMaxHeight = Math.max(rowMaxHeight, boxHeight);
      if (currentColumn === 0) estimatedPostHeight = boxHeight;

      currentColumn++;
    }

    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(`Page ${i} of ${pageCount}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
    }

    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
    const fileName = pdfFileName
      ? (pdfFileName.endsWith('.pdf') ? pdfFileName : `${pdfFileName}.pdf`)
      : `content-calendar-${new Date().toISOString().split('T')[0]}.pdf`;

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error('Portal PDF export error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate PDF' },
      { status: 500 }
    );
  }
}
