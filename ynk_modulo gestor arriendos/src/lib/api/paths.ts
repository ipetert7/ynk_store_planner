const DEFAULT_BASE_PATH = '/arriendos'

function getAppBasePath(): string {
  return (process.env.NEXT_PUBLIC_BASE_PATH || DEFAULT_BASE_PATH).replace(/\/$/, '')
}

export function resolveApiPath(path: string): string {
  if (/^https?:\/\//i.test(path)) {
    return path
  }

  const appBasePath = getAppBasePath()

  if (path.startsWith(`${appBasePath}/`)) {
    return path
  }

  if (path.startsWith('/api/')) {
    return `${appBasePath}${path}`
  }

  return path
}
