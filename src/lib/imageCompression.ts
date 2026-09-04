import logger from './logger'

// Compress/resize an image data URL if it's too large.
// Uses iterative compression with progressively more aggressive settings.
export async function compressImageIfNeeded(
  imageData: string,
  maxSizeBytes: number = 3 * 1024 * 1024, // 3MB default - accounts for base64 overhead (~33%) + other request fields
  maxRequestSizeBytes: number = 4.5 * 1024 * 1024 // 4.5MB total request body limit (Vercel's API route limit)
): Promise<string> {
  // If it's not a data URL, return as-is
  if (!imageData.startsWith('data:')) {
    return imageData
  }

  // Calculate actual image size
  const base64Data = imageData.split(',')[1] || imageData
  const padding = (base64Data.match(/=/g) || []).length
  const actualSize = Math.floor((base64Data.length * 3) / 4) - padding

  // If image is already small enough, return as-is
  if (actualSize <= maxSizeBytes) {
    return imageData
  }

  try {
    // Create an image element to get dimensions
    const img = new Image()
    const imgLoadPromise = new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = reject
    })
    img.src = imageData
    await imgLoadPromise

    const originalWidth = img.width
    const originalHeight = img.height
    const mimeType = imageData.match(/data:([^;]+)/)?.[1] || 'image/jpeg'

    // Progressive compression: try multiple quality/dimension combinations
    // More aggressive compression to stay under Vercel's 4.5MB API route limit
    const compressionAttempts = [
      { maxDimension: 1920, quality: 0.75 }, // First attempt: moderate compression
      { maxDimension: 1600, quality: 0.65 }, // Second attempt: more aggressive
      { maxDimension: 1280, quality: 0.55 }, // Third attempt: very aggressive
      { maxDimension: 1024, quality: 0.45 }, // Fourth attempt: maximum compression
    ]

    for (const attempt of compressionAttempts) {
      // Calculate target dimensions
      let targetWidth = originalWidth
      let targetHeight = originalHeight

      if (originalWidth > attempt.maxDimension || originalHeight > attempt.maxDimension) {
        if (originalWidth > originalHeight) {
          targetWidth = attempt.maxDimension
          targetHeight = Math.round((originalHeight / originalWidth) * attempt.maxDimension)
        } else {
          targetHeight = attempt.maxDimension
          targetWidth = Math.round((originalWidth / originalHeight) * attempt.maxDimension)
        }
      }

      // Create canvas and compress
      const canvas = document.createElement('canvas')
      canvas.width = targetWidth
      canvas.height = targetHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        logger.warn('Could not get canvas context, returning original image')
        return imageData
      }

      // Use better image rendering for compression
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'

      // Draw resized image
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight)

      // Convert to compressed base64
      const compressedDataUrl = canvas.toDataURL(mimeType, attempt.quality)

      // Check if compression achieved target size
      const compressedBase64 = compressedDataUrl.split(',')[1] || compressedDataUrl
      const compressedPadding = (compressedBase64.match(/=/g) || []).length
      const compressedSize = Math.floor((compressedBase64.length * 3) / 4) - compressedPadding

      logger.info('🖼️ Image compression attempt', {
        originalSize: `${(actualSize / (1024 * 1024)).toFixed(2)}MB`,
        compressedSize: `${(compressedSize / (1024 * 1024)).toFixed(2)}MB`,
        originalDimensions: `${originalWidth}x${originalHeight}`,
        compressedDimensions: `${targetWidth}x${targetHeight}`,
        quality: attempt.quality,
        maxDimension: attempt.maxDimension,
      })

      // If we've achieved the target size, return this version
      if (compressedSize <= maxSizeBytes) {
        return compressedDataUrl
      }

      // If this is the last attempt, return it anyway (best we can do)
      if (attempt === compressionAttempts[compressionAttempts.length - 1]) {
        logger.warn('⚠️ Image still too large after maximum compression', {
          finalSize: `${(compressedSize / (1024 * 1024)).toFixed(2)}MB`,
          targetSize: `${(maxSizeBytes / (1024 * 1024)).toFixed(2)}MB`,
        })
        return compressedDataUrl
      }
    }

    // Fallback: return original if all attempts somehow failed
    return imageData
  } catch (error) {
    logger.error('Error compressing image:', error)
    // If compression fails, return original (will be caught by size check later)
    return imageData
  }
}

// Resolve a blob/HTTPS/data URL for an uploaded image or video into a data URL suitable
// for the AI vision API, compressing it if needed. Videos get a placeholder since the API
// can't analyze video content.
export async function prepareImageDataForAI(image: {
  mediaType?: 'image' | 'video'
  blobUrl?: string
  preview?: string
}): Promise<string | undefined> {
  if (image.mediaType === 'video') return 'VIDEO_PLACEHOLDER'
  const url = image.blobUrl || image.preview
  if (!url) return undefined

  if (url.startsWith('data:')) return compressImageIfNeeded(url)

  try {
    const response = await fetch(url)
    const blob = await response.blob()
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
    return compressImageIfNeeded(dataUrl)
  } catch {
    return url // fallback — server handles HTTPS URLs natively
  }
}
