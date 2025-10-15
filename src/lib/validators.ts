/**
 * Validation and sanitization utilities
 */

/**
 * Validates UUID v4 format
 * @param uuid - String to validate
 * @returns true if valid UUID v4, false otherwise
 */
export function isValidUUID(uuid: string): boolean {
  if (!uuid || typeof uuid !== 'string') {
    return false;
  }

  // UUID v4 regex pattern
  const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidV4Regex.test(uuid);
}

/**
 * Cleans and validates a UUID
 * @param uuid - UUID string to sanitize
 * @returns Sanitized UUID if valid, null otherwise
 */
export function sanitizeUUID(uuid: string | null | undefined): string | null {
  if (!uuid) {
    return null;
  }

  // Trim whitespace
  const trimmed = uuid.trim();

  // Validate format
  if (!isValidUUID(trimmed)) {
    return null;
  }

  // Return lowercase normalized UUID
  return trimmed.toLowerCase();
}

/**
 * Validates email format
 * @param email - Email string to validate
 * @returns true if valid email format, false otherwise
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') {
    return false;
  }

  // RFC 5322 compliant email regex (simplified but robust)
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  
  return emailRegex.test(email) && email.length <= 254; // Max email length per RFC
}

/**
 * Removes dangerous characters from filenames
 * Prevents directory traversal and other file system attacks
 * @param filename - Filename to sanitize
 * @returns Sanitized filename
 */
export function sanitizeFilename(filename: string): string {
  if (!filename || typeof filename !== 'string') {
    return 'unnamed';
  }

  // Remove path separators and dangerous characters
  let sanitized = filename
    .replace(/[\/\\]/g, '') // Remove forward and back slashes
    .replace(/\.\./g, '') // Remove parent directory references
    .replace(/[<>:"|?*\x00-\x1f]/g, '') // Remove invalid Windows filename chars
    .replace(/^\.+/, '') // Remove leading dots
    .trim();

  // If filename is empty after sanitization, use default
  if (!sanitized || sanitized.length === 0) {
    return 'unnamed';
  }

  // Limit length (max 255 characters for most filesystems)
  if (sanitized.length > 255) {
    const ext = sanitized.substring(sanitized.lastIndexOf('.'));
    const name = sanitized.substring(0, 255 - ext.length);
    sanitized = name + ext;
  }

  return sanitized;
}
