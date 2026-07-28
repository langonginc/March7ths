export function assetUrl(path: string): string {
  const cleanPath = path.replace(/^\/+/, '')
  return `${import.meta.env.BASE_URL}${cleanPath}`
}

export function versionedAssetUrl(path: string): string {
  return `${assetUrl(path)}?v=${encodeURIComponent(__APP_VERSION__)}`
}

export function routerBasename(): string | undefined {
  const base = import.meta.env.BASE_URL.replace(/\/+$/, '')
  return base || undefined
}
