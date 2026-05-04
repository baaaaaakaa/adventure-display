export function resolvePublicAssetSrc(value: string | null | undefined) {
  const src = value?.trim() ?? ''

  if (!src || !src.startsWith('/')) {
    return src
  }

  const baseUrl = import.meta.env.BASE_URL || '/'

  if (baseUrl === '/') {
    return src
  }

  return `${baseUrl.replace(/\/$/, '')}${src}`
}
