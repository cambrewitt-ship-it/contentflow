// Safe logging utility to prevent terminal flooding with binary data
// NOTE: This utility is deprecated - use the new logger from @/lib/logger instead
import logger from './logger';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const logSafely = (label: string, obj: any) => {
  const safe = { ...obj };
  
  // Hide large image data
  if (safe.image_data) safe.image_data = '[HIDDEN]';
  if (safe.image_url?.length > 100) safe.image_url = '[URL_HIDDEN]';
  if (safe.generatedImage?.length > 100) safe.generatedImage = '[IMAGE_HIDDEN]';
  if (safe.preview?.length > 100) safe.preview = '[PREVIEW_HIDDEN]';
  
  // Hide other potentially large fields
  if (safe.post_data?.image_url?.length > 100) safe.post_data.image_url = '[POST_IMAGE_HIDDEN]';
  if (safe.scheduledPost?.image_url?.length > 100) safe.scheduledPost.image_url = '[SCHEDULED_IMAGE_HIDDEN]';
  
  // Limit string lengths
  Object.keys(safe).forEach(key => {
    if (typeof safe[key] === 'string' && safe[key].length > 200) {
      safe[key] = safe[key].substring(0, 200) + '...[TRUNCATED]';
    }
  });
  
  logger.debug(label, safe);
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const logImageInfo = (label: string, obj: any) => {
  const info = {
    hasImage: !!obj.image_url,
    imageType: typeof obj.image_url,
    imageLength: obj.image_url?.length || 0,
    imageStart: obj.image_url?.substring(0, 50) || 'none'
  };
  logger.debug(label, info);
};
