/**
 * Timezone utilities for ContentFlow
 * Centralized timezone options and helper functions
 */

export interface TimezoneOption {
  value: string;
  label: string;
  region: 'Pacific' | 'Americas' | 'Europe' | 'Asia' | 'Other';
}

/**
 * Default timezone used as fallback
 */
export const DEFAULT_TIMEZONE = 'Pacific/Auckland';

/**
 * All available timezone options for client configuration
 * Organized by region with IANA timezone identifiers
 */
export const TIMEZONE_OPTIONS: TimezoneOption[] = [
  // Pacific
  { value: 'Pacific/Auckland', label: 'New Zealand (Pacific/Auckland)', region: 'Pacific' },
  { value: 'Pacific/Chatham', label: 'New Zealand - Chatham Islands (Pacific/Chatham)', region: 'Pacific' },
  { value: 'Australia/Sydney', label: 'Australia - Sydney (Australia/Sydney)', region: 'Pacific' },
  { value: 'Australia/Melbourne', label: 'Australia - Melbourne (Australia/Melbourne)', region: 'Pacific' },
  { value: 'Australia/Brisbane', label: 'Australia - Brisbane (Australia/Brisbane)', region: 'Pacific' },
  { value: 'Australia/Perth', label: 'Australia - Perth (Australia/Perth)', region: 'Pacific' },
  { value: 'Australia/Adelaide', label: 'Australia - Adelaide (Australia/Adelaide)', region: 'Pacific' },
  { value: 'Australia/Hobart', label: 'Australia - Hobart (Australia/Hobart)', region: 'Pacific' },
  { value: 'Australia/Darwin', label: 'Australia - Darwin (Australia/Darwin)', region: 'Pacific' },
  
  // Americas
  { value: 'America/New_York', label: 'US Eastern (America/New_York)', region: 'Americas' },
  { value: 'America/Chicago', label: 'US Central (America/Chicago)', region: 'Americas' },
  { value: 'America/Denver', label: 'US Mountain (America/Denver)', region: 'Americas' },
  { value: 'America/Los_Angeles', label: 'US Pacific (America/Los_Angeles)', region: 'Americas' },
  { value: 'America/Anchorage', label: 'US Alaska (America/Anchorage)', region: 'Americas' },
  { value: 'Pacific/Honolulu', label: 'US Hawaii (Pacific/Honolulu)', region: 'Americas' },
  { value: 'America/Toronto', label: 'Canada - Toronto (America/Toronto)', region: 'Americas' },
  { value: 'America/Vancouver', label: 'Canada - Vancouver (America/Vancouver)', region: 'Americas' },
  { value: 'America/Edmonton', label: 'Canada - Edmonton (America/Edmonton)', region: 'Americas' },
  { value: 'America/Winnipeg', label: 'Canada - Winnipeg (America/Winnipeg)', region: 'Americas' },
  { value: 'America/Halifax', label: 'Canada - Halifax (America/Halifax)', region: 'Americas' },
  
  // Europe
  { value: 'Europe/London', label: 'UK (Europe/London)', region: 'Europe' },
  { value: 'Europe/Dublin', label: 'Ireland (Europe/Dublin)', region: 'Europe' },
  { value: 'Europe/Paris', label: 'France (Europe/Paris)', region: 'Europe' },
  { value: 'Europe/Berlin', label: 'Germany (Europe/Berlin)', region: 'Europe' },
  { value: 'Europe/Rome', label: 'Italy (Europe/Rome)', region: 'Europe' },
  { value: 'Europe/Madrid', label: 'Spain (Europe/Madrid)', region: 'Europe' },
  { value: 'Europe/Amsterdam', label: 'Netherlands (Europe/Amsterdam)', region: 'Europe' },
  { value: 'Europe/Brussels', label: 'Belgium (Europe/Brussels)', region: 'Europe' },
  { value: 'Europe/Zurich', label: 'Switzerland (Europe/Zurich)', region: 'Europe' },
  { value: 'Europe/Stockholm', label: 'Sweden (Europe/Stockholm)', region: 'Europe' },
  
  // Asia
  { value: 'Asia/Dubai', label: 'UAE (Asia/Dubai)', region: 'Asia' },
  { value: 'Asia/Singapore', label: 'Singapore (Asia/Singapore)', region: 'Asia' },
  { value: 'Asia/Hong_Kong', label: 'Hong Kong (Asia/Hong_Kong)', region: 'Asia' },
  { value: 'Asia/Tokyo', label: 'Japan (Asia/Tokyo)', region: 'Asia' },
  { value: 'Asia/Seoul', label: 'South Korea (Asia/Seoul)', region: 'Asia' },
  { value: 'Asia/Shanghai', label: 'China (Asia/Shanghai)', region: 'Asia' },
  { value: 'Asia/Kolkata', label: 'India (Asia/Kolkata)', region: 'Asia' },
  { value: 'Asia/Bangkok', label: 'Thailand (Asia/Bangkok)', region: 'Asia' },
  
  // Other
  { value: 'Africa/Johannesburg', label: 'South Africa (Africa/Johannesburg)', region: 'Other' },
  { value: 'America/Sao_Paulo', label: 'Brazil (America/Sao_Paulo)', region: 'Other' },
  { value: 'America/Mexico_City', label: 'Mexico (America/Mexico_City)', region: 'Other' },
];

/**
 * Get timezone options grouped by region
 */
export function getTimezoneOptionsByRegion(): Record<string, TimezoneOption[]> {
  return TIMEZONE_OPTIONS.reduce((acc, option) => {
    if (!acc[option.region]) {
      acc[option.region] = [];
    }
    acc[option.region].push(option);
    return acc;
  }, {} as Record<string, TimezoneOption[]>);
}

/**
 * Get the display label for a timezone value
 */
export function getTimezoneLabel(timezone: string): string {
  const option = TIMEZONE_OPTIONS.find(opt => opt.value === timezone);
  return option?.label || timezone;
}

/**
 * Get a short display name for a timezone (e.g., "NZ" instead of full label)
 */
export function getTimezoneShortName(timezone: string): string {
  const shortNames: Record<string, string> = {
    'Pacific/Auckland': 'NZ',
    'Pacific/Chatham': 'NZ-Chatham',
    'Australia/Sydney': 'Sydney',
    'Australia/Melbourne': 'Melbourne',
    'Australia/Brisbane': 'Brisbane',
    'Australia/Perth': 'Perth',
    'Australia/Adelaide': 'Adelaide',
    'Australia/Hobart': 'Hobart',
    'Australia/Darwin': 'Darwin',
    'America/New_York': 'US-Eastern',
    'America/Chicago': 'US-Central',
    'America/Denver': 'US-Mountain',
    'America/Los_Angeles': 'US-Pacific',
    'America/Anchorage': 'US-Alaska',
    'Pacific/Honolulu': 'US-Hawaii',
    'America/Toronto': 'Toronto',
    'America/Vancouver': 'Vancouver',
    'Europe/London': 'UK',
    'Europe/Paris': 'Paris',
    'Europe/Berlin': 'Berlin',
    'Asia/Dubai': 'Dubai',
    'Asia/Singapore': 'Singapore',
    'Asia/Hong_Kong': 'Hong Kong',
    'Asia/Tokyo': 'Tokyo',
  };
  return shortNames[timezone] || timezone.split('/').pop() || timezone;
}

/**
 * Format a date in a specific timezone
 */
export function formatDateInTimezone(
  date: Date,
  timezone: string,
  options?: Intl.DateTimeFormatOptions
): string {
  const defaultOptions: Intl.DateTimeFormatOptions = {
    timeZone: timezone,
    ...options,
  };
  return date.toLocaleString('en-US', defaultOptions);
}

/**
 * Get a Date object adjusted for a specific timezone
 * Note: This creates a new Date that appears to be in the target timezone
 * when using toLocaleString without timezone option
 */
export function getDateInTimezone(date: Date, timezone: string): Date {
  return new Date(date.toLocaleString('en-US', { timeZone: timezone }));
}

/**
 * Get current time formatted for display in a timezone
 */
export function getCurrentTimeInTimezone(
  timezone: string,
  format: 'time' | 'date' | 'datetime' = 'datetime'
): string {
  const now = new Date();
  
  const timeOptions: Intl.DateTimeFormatOptions = {
    timeZone: timezone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  };
  
  const dateOptions: Intl.DateTimeFormatOptions = {
    timeZone: timezone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  };
  
  switch (format) {
    case 'time':
      return now.toLocaleString('en-US', timeOptions);
    case 'date':
      return now.toLocaleString('en-US', dateOptions);
    case 'datetime':
    default:
      return `${now.toLocaleString('en-US', timeOptions)} - ${now.toLocaleString('en-US', dateOptions)}`;
  }
}

/**
 * Check if a timezone string is valid IANA format
 */
export function isValidTimezone(timezone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the UTC offset for a timezone at a specific time
 * Returns string like "+12:00" or "-05:00"
 */
export function getTimezoneOffset(timezone: string, date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    timeZoneName: 'shortOffset',
  });
  
  const parts = formatter.formatToParts(date);
  const offsetPart = parts.find(part => part.type === 'timeZoneName');
  return offsetPart?.value || '';
}




