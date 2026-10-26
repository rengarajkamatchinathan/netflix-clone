// Channel logos are stored in the channels table (logo bytea + logo_type).
export const LOGO_TYPES: Record<string, string> = {
  'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/gif': '.gif', 'image/avif': '.avif', 'image/svg+xml': '.svg',
}
export const MAX_LOGO_BYTES = 2 * 1024 * 1024

export const logoTypeForFile = (name: string): string | undefined => {
  const ext = name.toLowerCase().match(/\.[a-z0-9]+$/)?.[0]
  if (ext === '.jpeg') return 'image/jpeg'
  return Object.entries(LOGO_TYPES).find(([, e]) => e === ext)?.[0]
}
