export function createCssUrl(value: string | null | undefined) {
  return value ? `url(${JSON.stringify(value)})` : undefined
}
