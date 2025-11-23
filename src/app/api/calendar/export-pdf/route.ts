import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import sizeOf from 'image-size';
import { NotoSansRegular } from '../fonts/NotoSans-Regular.js';
import { PoppinsBold } from '../fonts/Poppins-Bold.js';
import { PoppinsLight } from '../fonts/Poppins-Light.js';
import { createSupabaseWithToken } from '@/lib/supabaseServer';

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

// Helper function to format post date as "Sun 16th Nov"
function formatPostDate(dateString: string): string {
  if (!dateString || dateString === 'No Date') return 'No Date';
  
  try {
    const date = new Date(dateString);
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    const dayName = dayNames[date.getDay()];
    const day = date.getDate();
    const month = monthNames[date.getMonth()];
    
    // Add ordinal suffix (st, nd, rd, th)
    let suffix = 'th';
    if (day === 1 || day === 21 || day === 31) {
      suffix = 'st';
    } else if (day === 2 || day === 22) {
      suffix = 'nd';
    } else if (day === 3 || day === 23) {
      suffix = 'rd';
    }
    
    return `${dayName} ${day}${suffix} ${month}`;
  } catch {
    return dateString;
  }
}

// Helper function to add header with logos to a page
async function addHeaderWithLogos(
  doc: jsPDF,
  pageWidth: number,
  clientLogoUrl: string | null,
  companyLogoUrl: string | null,
  pdfTitle: string,
  clientName: string
): Promise<number> {
  const logoMaxHeight = 20; // 20mm max height (slightly bigger)
  const logoTopMargin = 5; // 5mm from top
  const logoSideMargin = 15; // 15mm from sides
  
  // Add client logo (top left)
  if (clientLogoUrl) {
    try {
      const clientLogoBase64 = await fetchImageAsBase64(clientLogoUrl);
      if (clientLogoBase64) {
        const clientLogoDims = await getImageDimensions(clientLogoBase64);
        const clientAspectRatio = clientLogoDims.width / clientLogoDims.height;
        
        let clientLogoWidth = logoMaxHeight * clientAspectRatio;
        let clientLogoHeight = logoMaxHeight;
        
        // If logo is wider than available space, scale down
        if (clientLogoWidth > (pageWidth / 2) - logoSideMargin) {
          clientLogoWidth = (pageWidth / 2) - logoSideMargin;
          clientLogoHeight = clientLogoWidth / clientAspectRatio;
        }
        
        // Determine image format
        let format: 'JPEG' | 'PNG' | 'WEBP' = 'JPEG';
        if (clientLogoBase64.includes('image/png')) {
          format = 'PNG';
        } else if (clientLogoBase64.includes('image/webp')) {
          format = 'WEBP';
        }
        
        doc.addImage(
          clientLogoBase64,
          format,
          logoSideMargin,
          logoTopMargin,
          clientLogoWidth,
          clientLogoHeight
        );
      }
    } catch (error) {
      console.error('Error adding client logo to PDF:', error);
    }
  }
  
  // Add company logo (top right)
  if (companyLogoUrl) {
    try {
      const companyLogoBase64 = await fetchImageAsBase64(companyLogoUrl);
      if (companyLogoBase64) {
        const companyLogoDims = await getImageDimensions(companyLogoBase64);
        const companyAspectRatio = companyLogoDims.width / companyLogoDims.height;
        
        let companyLogoWidth = logoMaxHeight * companyAspectRatio;
        let companyLogoHeight = logoMaxHeight;
        
        // If logo is wider than available space, scale down
        if (companyLogoWidth > (pageWidth / 2) - logoSideMargin) {
          companyLogoWidth = (pageWidth / 2) - logoSideMargin;
          companyLogoHeight = companyLogoWidth / companyAspectRatio;
        }
        
        // Determine image format
        let format: 'JPEG' | 'PNG' | 'WEBP' = 'JPEG';
        if (companyLogoBase64.includes('image/png')) {
          format = 'PNG';
        } else if (companyLogoBase64.includes('image/webp')) {
          format = 'WEBP';
        }
        
        doc.addImage(
          companyLogoBase64,
          format,
          pageWidth - logoSideMargin - companyLogoWidth,
          logoTopMargin,
          companyLogoWidth,
          companyLogoHeight
        );
      }
    } catch (error) {
      console.error('Error adding company logo to PDF:', error);
    }
  }
  
  // Add title and client name centered below logos
  const titleY = logoTopMargin + logoMaxHeight + 4; // Reduced spacing from 8 to 4
  
  doc.setFontSize(24);
  doc.setFont('Poppins', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(pdfTitle, pageWidth / 2, titleY, { align: 'center' });
  
  const clientNameY = titleY + 8;
  doc.setFontSize(16);
  doc.setFont('PoppinsLight', 'normal');
  doc.text(clientName, pageWidth / 2, clientNameY, { align: 'center' });
  
  // Add line separator (removed "Generated on" text)
  const separatorY = clientNameY + 6;
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.line(logoSideMargin, separatorY, pageWidth - logoSideMargin, separatorY);
  
  // Return the Y position after the header (separator + spacing)
  return separatorY + 2;
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

    const token = authHeader.substring(7);
    const userSupabase = createSupabaseWithToken(token);
    
    // Get authenticated user
    const { data: { user }, error: userError } = await userSupabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid token' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { postIds, clientId, pdfTitle = 'Content Calendar', pdfFileName } = body;

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

    // Fetch client data with logo
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('name, logo_url')
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      console.error('Error fetching client:', clientError);
      return NextResponse.json(
        { error: 'Client not found' },
        { status: 404 }
      );
    }

    // Fetch user profile for company logo
    const { data: userProfile, error: profileError } = await userSupabase
      .from('user_profiles')
      .select('company_logo_url')
      .eq('id', user.id)
      .single();

    const companyLogoUrl = userProfile?.company_logo_url || null;
    const clientLogoUrl = client.logo_url || null;

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
    
    // Add Poppins fonts
    doc.addFileToVFS('Poppins-Bold.ttf', PoppinsBold);
    doc.addFont('Poppins-Bold.ttf', 'Poppins', 'bold');
    
    doc.addFileToVFS('Poppins-Light.ttf', PoppinsLight);
    doc.addFont('Poppins-Light.ttf', 'PoppinsLight', 'normal');
    
    // Use Helvetica by default for proper spacing (switch to NotoSans when emojis detected)
    doc.setFont('helvetica', 'normal');

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    // Add header with logos on first page and get the Y position after header
    const headerHeight = await addHeaderWithLogos(doc, pageWidth, clientLogoUrl, companyLogoUrl, pdfTitle, client.name);
    let yPosition = headerHeight;

    // Group posts by date
    const postsByDate: { [key: string]: typeof posts } = {};
    posts.forEach(post => {
      const dateKey = post.scheduled_date || 'No Date';
      if (!postsByDate[dateKey]) {
        postsByDate[dateKey] = [];
      }
      postsByDate[dateKey].push(post);
    });

    // Layout constants for 3-column layout (centered)
    const columnGap = 10; // Gap between columns (increased from 5)
    const columnWidth = 75; // Fixed column width in mm (increased from 60)
    const totalColumnsWidth = (3 * columnWidth) + (2 * columnGap); // Total width of all 3 columns + gaps
    
    // Calculate start position so middle column is centered on page
    // Middle column center = startX + columnWidth + columnGap + columnWidth/2
    // We want this to equal pageWidth / 2
    // So: startX = pageWidth / 2 - 1.5 * columnWidth - columnGap
    const startX = (pageWidth / 2) - (1.5 * columnWidth) - columnGap;
    
    const maxImageWidth = columnWidth - 4; // Image width fits within column with small padding (2mm on each side)
    const maxImageHeight = 110; // Maximum height in mm (increased from 90 to accommodate larger images)

    // Flatten all posts to track total count and check if we have more posts
    const allPosts: Array<{ post: typeof posts[0]; date: string }> = [];
    for (const [date, datePosts] of Object.entries(postsByDate)) {
      for (const post of datePosts) {
        allPosts.push({ post, date });
      }
    }
    const totalPosts = allPosts.length;

    // Track column position across all dates (0, 1, or 2)
    let currentColumn = 0;
    let rowStartY = yPosition; // Track the Y position where the current row started
    let rowMaxHeight = 0; // Track the maximum height in the current row
    let currentPostIndex = 0;
    let currentDate = '';
    let pageStartHeaderY = headerHeight; // Track header Y for current page
    let estimatedPostHeight = 100; // Dynamic estimate that improves as we render posts
    
    // Helper function to calculate centered Y position for posts on a page
    const calculateCenteredY = (headerY: number, contentHeight: number): number => {
      const bottomMargin = 15; // Space for page numbers at bottom
      const availableHeight = pageHeight - headerY - bottomMargin;
      // Center the content vertically
      return headerY + (availableHeight - contentHeight) / 2;
    };

    // Render all posts
    for (const { post, date } of allPosts) {
      currentPostIndex++;
      const isLastPost = currentPostIndex === totalPosts;
      
      // If we've filled 3 columns (3 posts), always start a new page
      if (currentColumn >= 3) {
        doc.addPage();
        // Add header with logos on new page and get the Y position after header
        const newHeaderHeight = await addHeaderWithLogos(doc, pageWidth, clientLogoUrl, companyLogoUrl, pdfTitle, client.name);
        pageStartHeaderY = newHeaderHeight;
        // Start with header position, will center after we know actual content height
        rowStartY = newHeaderHeight;
        yPosition = rowStartY;
        rowMaxHeight = 0;
        currentColumn = 0;
      }
      
      // Check if we need a new page (only at start of new row/page)
      if (currentColumn === 0 && yPosition > pageHeight - 40) {
        doc.addPage();
        // Add header with logos on new page and get the Y position after header
        const newHeaderHeight = await addHeaderWithLogos(doc, pageWidth, clientLogoUrl, companyLogoUrl, pdfTitle, client.name);
        pageStartHeaderY = newHeaderHeight;
        // Start with header position, will center after we know actual content height
        rowStartY = newHeaderHeight;
        yPosition = rowStartY;
        currentColumn = 0;
        rowMaxHeight = 0;
      }
      
      // On first post of a page, adjust vertical centering based on estimated height
      if (currentColumn === 0) {
        const centeredY = calculateCenteredY(pageStartHeaderY, estimatedPostHeight);
        // Adjust rowStartY to center the content
        rowStartY = centeredY;
        yPosition = centeredY;
      }

      // Track current date (no longer displaying date header on left)
      if (date !== currentDate) {
        currentDate = date;
      }
      
      // Calculate column X position explicitly for each column (centered layout)
      // Column 0: startX
      // Column 1: startX + columnWidth + columnGap (this should be centered)
      // Column 2: startX + 2*columnWidth + 2*columnGap
      let columnX: number;
      if (currentColumn === 0) {
        columnX = startX;
      } else if (currentColumn === 1) {
        columnX = startX + columnWidth + columnGap;
      } else if (currentColumn === 2) {
        columnX = startX + (2 * columnWidth) + (2 * columnGap);
      } else {
        // Fallback - should not reach here
        columnX = startX;
        currentColumn = 0;
      }
        
        const startY = rowStartY;
        
        // Add post date and time at the top of each post
        const postDateY = startY;
        doc.setFontSize(12); // Increased from 9
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        
        const postDateText = formatPostDate(post.scheduled_date || 'No Date');
        const postTimeText = post.scheduled_time ? formatTime(post.scheduled_time) : '';
        const dateTimeText = postTimeText ? `${postDateText} ${postTimeText}` : postDateText;
        
        const postDateX = columnX + 2; // Same padding as image
        doc.text(dateTimeText, postDateX, postDateY);
        
        const imageX = columnX + 2; // Small padding from column edge (2mm)
        const imageY = postDateY + 5; // Position image below date/time
        
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

        // Platform only (time removed)
        doc.setFontSize(10); // Slightly smaller font for 3-column layout
        doc.setTextColor(0, 0, 0);
        
        let detailsText = '';
        if (post.platform) {
          const cleanPlatform = cleanTextForPDF(post.platform);
          detailsText = cleanPlatform;
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
        doc.setFontSize(12); // Increased from 10
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
        
        // After first post is rendered, update estimate for better centering on future pages
        if (currentColumn === 0) {
          // Use actual height of first post as better estimate for future pages
          estimatedPostHeight = boxHeight;
        }

        // Post border removed - no outline around posts

        // Move to next column
        currentColumn++;
        
        // If we've filled 3 columns (3 posts), prepare for new page on next iteration
        // The new page will be created at the start of the next loop iteration
        // This ensures exactly 3 posts per page maximum
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

    // Generate filename - use provided filename or default
    const fileName = pdfFileName 
      ? (pdfFileName.endsWith('.pdf') ? pdfFileName : `${pdfFileName}.pdf`)
      : `content-calendar-${new Date().toISOString().split('T')[0]}.pdf`;

    // Return PDF as response
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
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

