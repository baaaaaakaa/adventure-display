import type { ProjectState } from '../types/adventure'

function isObjectUrl(value: string) {
  return value.startsWith('blob:')
}

function collectObjectUrls(value: unknown, urls: Set<string>) {
  if (typeof value === 'string') {
    if (isObjectUrl(value)) {
      urls.add(value)
    }

    return
  }

  if (Array.isArray(value)) {
    value.forEach((entry) => collectObjectUrls(entry, urls))
    return
  }

  if (value && typeof value === 'object') {
    Object.values(value).forEach((entry) => collectObjectUrls(entry, urls))
  }
}

export function collectProjectObjectUrls(projectState: ProjectState) {
  const urls = new Set<string>()
  collectObjectUrls(projectState, urls)
  return urls
}

export function revokeObjectUrls(urls: Iterable<string>) {
  for (const url of urls) {
    URL.revokeObjectURL(url)
  }
}
