import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import sizeOf from 'image-size';
import { NotoSansRegular } from '../fonts/NotoSans-Regular.js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Helper function to fetch image as base64
async function fetchImageAsBase64(imageUrl: string): Promise<string | null> {
  try {
    // Already base64 data URL
    if (imageUrl.startsWith('data:image')) {
      return imageUrl;
    }

    // Fetch HTTP/HTTPS URLs and convert to base64
    if (imageUrl.startsWith('http')) {
      const response = await fetch(imageUrl);
      if (!response.ok) {
        console.error('Failed to fetch image:', imageUrl);
        return null;
      }
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const base64 = buffer.toString('base64');
      
      // Detect image type from URL or content
      let mimeType = 'image/jpeg';
      if (imageUrl.toLowerCase().endsWith('.png')) {
        mimeType = 'image/png';
      } else if (imageUrl.toLowerCase().endsWith('.gif')) {
        mimeType = 'image/gif';
      } else if (imageUrl.toLowerCase().endsWith('.webp')) {
        mimeType = 'image/webp';
      }
      
      return `data:${mimeType};base64,${base64}`;
    }

    return null;
  } catch (error) {
    console.error('Error fetching image:', error);
    return null;
  }
}

// Helper function to get image dimensions from base64
async function getImageDimensions(base64: string): Promise<{ width: number; height: number }> {
  try {
    // Extract base64 data
    const base64Data = base64.split(',')[1] || base64;
    const buffer = Buffer.from(base64Data, 'base64');
    
    // Use image-size library for reliable dimension detection
    const dimensions = sizeOf(buffer);
    
    if (dimensions.width && dimensions.height) {
      return { width: dimensions.width, height: dimensions.height };
    }
    
    // Fallback to default if detection fails
    return { width: 1080, height: 1080 };
  } catch (error) {
    console.error('Error getting image dimensions:', error);
    return { width: 1080, height: 1080 };
  }
}

// Helper function to check if text contains emojis or special Unicode characters
function hasEmojiOrUnicode(text: string): boolean {
  if (!text) return false;
  // Check for emojis and common Unicode characters beyond ASCII
  return /[^\x00-\x7F]/.test(text);
}

// Helper function to clean text for PDF (keep emojis, remove only problematic characters)
function cleanTextForPDF(text: string): string {
  if (!text) return '';
  
  // Only remove characters that cause rendering issues
  // Keep emojis and most Unicode characters
  return text
    .replace(/[\uFFFD]/g, '')  // Remove replacement character
    .trim();
}

// Helper function to format date
function formatDate(dateString: string): string {
  if (!dateString || dateString === 'No Date') return 'No Date';
  
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'long',
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  } catch {
    return dateString;
  }
}

// Helper function to format time
function formatTime(timeString: string): string {
  if (!timeString) return '';
  
  const timeParts = timeString.split(':');
  const hours = parseInt(timeParts[0]);
  const minutes = timeParts[1] || '00';
  
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  
  return `${hour12}:${minutes} ${ampm}`;
}

export async function POST(request: NextRequest) {
  try {
    // Check authorization
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized - Missing token' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { postIds, clientId } = body;

    if (!postIds || !Array.isArray(postIds) || postIds.length === 0) {
      return NextResponse.json(
        { error: 'Post IDs are required' },
        { status: 400 }
      );
    }

    if (!clientId) {
      return NextResponse.json(
        { error: 'Client ID is required' },
        { status: 400 }
      );
    }

    // Fetch client data
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('name')
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      console.error('Error fetching client:', clientError);
      return NextResponse.json(
        { error: 'Client not found' },
        { status: 404 }
      );
    }

    // Fetch posts data
    const { data: posts, error: postsError } = await supabase
      .from('calendar_scheduled_posts')
      .select('*')
      .in('id', postIds)
      .eq('client_id', clientId)
      .order('scheduled_date', { ascending: true })
      .order('scheduled_time', { ascending: true });

    if (postsError || !posts || posts.length === 0) {
      console.error('Error fetching posts:', postsError);
      return NextResponse.json(
        { error: 'Posts not found' },
        { status: 404 }
      );
    }

    // Create PDF document
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
    });

    // Add Unicode font support for emojis
    doc.addFileToVFS('NotoSans-Regular.ttf', NotoSansRegular);
    doc.addFont('NotoSans-Regular.ttf', 'NotoSans', 'normal');
    
    // Use Helvetica by default for proper spacing (switch to NotoSans when emojis detected)
    doc.setFont('helvetica', 'normal');

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let yPosition = 20;

    // Add header
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('Content Calendar', pageWidth / 2, yPosition, { align: 'center' });
    
    yPosition += 10;
    doc.setFontSize(16);
    doc.setFont('helvetica', 'normal');
    doc.text(client.name, pageWidth / 2, yPosition, { align: 'center' });
    
    yPosition += 8;
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(
      `Generated on ${new Date().toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      })}`,
      pageWidth / 2,
      yPosition,
      { align: 'center' }
    );
    
    yPosition += 8;
    
    // Add line separator
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.5);
    doc.line(15, yPosition, pageWidth - 15, yPosition);
    
    yPosition += 10;

    // Group posts by date
    const postsByDate: { [key: string]: typeof posts } = {};
    posts.forEach(post => {
      const dateKey = post.scheduled_date || 'No Date';
      if (!postsByDate[dateKey]) {
        postsByDate[dateKey] = [];
      }
      postsByDate[dateKey].push(post);
    });

    // Layout constants for 3-column layout
    const marginLeft = 15;
    const marginRight = 15;
    const columnGap = 5; // Gap between columns
    const availableWidth = pageWidth - marginLeft - marginRight;
    // For 3 columns: total width = 3 * columnWidth + 2 * columnGap
    const columnWidth = (availableWidth - (columnGap * 2)) / 3; // Width for each of 3 columns
    const maxImageWidth = columnWidth - 4; // Image width fits within column with small padding (2mm on each side)
    const maxImageHeight = 90; // Maximum height in mm (reduced to fit 3 columns)

    // Track column position across all dates (0, 1, or 2)
    let currentColumn = 0;
    let rowStartY = yPosition; // Track the Y position where the current row started
    let rowMaxHeight = 0; // Track the maximum height in the current row

    // Render posts grouped by date
    for (const [date, datePosts] of Object.entries(postsByDate)) {
      // Check if we need a new page
      if (yPosition > pageHeight - 40) {
        doc.addPage();
        yPosition = 20;
        rowStartY = 20;
        currentColumn = 0;
        rowMaxHeight = 0;
      }

      // Date header - only show if we're starting a new row (column 0)
      if (currentColumn === 0) {
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text(formatDate(date), marginLeft, rowStartY);
        rowStartY += 6;
        yPosition = rowStartY;
      }

      // Render each post
      for (const post of datePosts) {
        // Calculate column X position explicitly for each column
        // Column 0: marginLeft
        // Column 1: marginLeft + columnWidth + columnGap  
        // Column 2: marginLeft + 2*columnWidth + 2*columnGap
        let columnX: number;
        if (currentColumn === 0) {
          columnX = marginLeft;
        } else if (currentColumn === 1) {
          columnX = marginLeft + columnWidth + columnGap;
        } else {
          columnX = marginLeft + (2 * columnWidth) + (2 * columnGap);
        }
        
        const startY = rowStartY;
        const imageX = columnX + 2; // Small padding from column edge (2mm)
        const imageY = startY + 2;
        
        // Ensure image doesn't exceed column width
        const effectiveMaxImageWidth = Math.min(maxImageWidth, columnWidth - 4);

        // Try to add image
        let imageAdded = false;
        let actualImageWidth = effectiveMaxImageWidth;
        let actualImageHeight = effectiveMaxImageWidth; // Default to square
        
        if (post.image_url) {
          try {
            const imageBase64 = await fetchImageAsBase64(post.image_url);
            if (imageBase64) {
              // Get actual image dimensions
              const imageDimensions = await getImageDimensions(imageBase64);
              const aspectRatio = imageDimensions.width / imageDimensions.height;
              
              // Calculate scaled dimensions while preserving aspect ratio
              if (aspectRatio > 1) {
                // Landscape orientation
                actualImageWidth = effectiveMaxImageWidth;
                actualImageHeight = effectiveMaxImageWidth / aspectRatio;
              } else if (aspectRatio < 1) {
                // Portrait orientation
                actualImageHeight = Math.min(maxImageHeight, effectiveMaxImageWidth / aspectRatio);
                actualImageWidth = actualImageHeight * aspectRatio;
              } else {
                // Square (aspect ratio = 1)
                actualImageWidth = effectiveMaxImageWidth;
                actualImageHeight = effectiveMaxImageWidth;
              }
              
              // Determine image format
              let format: 'JPEG' | 'PNG' | 'WEBP' = 'JPEG';
              if (imageBase64.includes('image/png')) {
                format = 'PNG';
              } else if (imageBase64.includes('image/webp')) {
                format = 'WEBP';
              }
              
              doc.addImage(imageBase64, format, imageX, imageY, actualImageWidth, actualImageHeight);
              imageAdded = true;
            }
          } catch (error) {
            console.error('Error adding image to PDF:', error);
            // Draw placeholder rectangle
            doc.setFillColor(240, 240, 240);
            doc.rect(imageX, imageY, actualImageWidth, actualImageHeight, 'F');
            doc.setFontSize(8);
            doc.setTextColor(150, 150, 150);
            doc.text('Image', imageX + actualImageWidth / 2, imageY + actualImageHeight / 2, { align: 'center' });
          }
        }

        if (!imageAdded) {
          // Draw placeholder if no image
          doc.setFillColor(240, 240, 240);
          doc.rect(imageX, imageY, actualImageWidth, actualImageHeight, 'F');
          doc.setFontSize(8);
          doc.setTextColor(150, 150, 150);
          doc.text('No Image', imageX + actualImageWidth / 2, imageY + actualImageHeight / 2, { align: 'center' });
        }

        // Post details (below image)
        // Ensure text width exactly matches the actual image width
        const textX = imageX;
        const textWidth = actualImageWidth; // Text width matches image width exactly
        let textY = imageY + actualImageHeight + 4; // Position text below image

        // Time and Platform
        doc.setFontSize(10); // Slightly smaller font for 3-column layout
        doc.setTextColor(0, 0, 0);
        
        let detailsText = '';
        if (post.scheduled_time) {
          detailsText += formatTime(post.scheduled_time);
        }
        if (post.platform) {
          const cleanPlatform = cleanTextForPDF(post.platform);
          detailsText += detailsText ? ` - ${cleanPlatform}` : cleanPlatform;
        }
        
        // Use NotoSans if text contains emojis/Unicode, otherwise use Helvetica for better spacing
        if (detailsText && hasEmojiOrUnicode(detailsText)) {
          doc.setFont('NotoSans', 'bold');
        } else {
          doc.setFont('helvetica', 'bold');
        }
        
        if (detailsText) {
          doc.text(detailsText, textX, textY + 4);
          textY += 6;
        }

        // Caption
        doc.setFontSize(10); // Slightly smaller font for 3-column layout
        doc.setTextColor(60, 60, 60);
        
        const rawCaption = post.caption || 'No caption';
        const cleanedCaption = cleanTextForPDF(rawCaption);
        const captionText = cleanedCaption || 'No caption';
        
        // Use NotoSans if text contains emojis/Unicode, otherwise use Helvetica for better spacing
        if (hasEmojiOrUnicode(captionText)) {
          doc.setFont('NotoSans', 'normal');
        } else {
          doc.setFont('helvetica', 'normal');
        }
        
        const maxCaptionLength = 200;
        const truncatedCaption =
          captionText.length > maxCaptionLength
            ? captionText.substring(0, maxCaptionLength) + '...'
            : captionText;

        // Split caption text to fit exactly within the image width
        const captionLines = doc.splitTextToSize(truncatedCaption, textWidth);
        doc.text(captionLines, textX, textY + 4);
        textY += captionLines.length * 4 + 2;

        // Calculate box height based on actual image height
        const boxHeight = Math.max(actualImageHeight + 10, textY - startY + 5);
        
        // Track the maximum height in this row
        rowMaxHeight = Math.max(rowMaxHeight, boxHeight);

        // Post border removed - no outline around posts

        // Move to next column
        currentColumn++;
        
        // If we've filled 3 columns, move to next row
        if (currentColumn >= 3) {
          // Calculate where the next row would start
          const nextRowY = rowStartY + rowMaxHeight + 8;
          
          // Only check for new page AFTER we've placed all 3 posts in the current row
          // Check if the next row would fit on the current page
          if (nextRowY > pageHeight - 50) {
            // Next row won't fit, start a new page
            doc.addPage();
            yPosition = 20;
            rowStartY = 20;
          } else {
            // Next row fits, move Y position down
            yPosition = nextRowY;
            rowStartY = nextRowY;
          }
          
          // Reset for new row
          rowMaxHeight = 0;
          currentColumn = 0;
        }
      }
    }

    // Add page numbers to all pages
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(
        `Page ${i} of ${pageCount}`,
        pageWidth / 2,
        pageHeight - 10,
        { align: 'center' }
      );
    }

    // Generate PDF as buffer
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));

    // Return PDF as response
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="content-calendar-${new Date().toISOString().split('T')[0]}.pdf"`,
      },
    });
  } catch (error) {
    console.error('Error generating PDF:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate PDF' },
      { status: 500 }
    );
  }
}

