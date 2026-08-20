/**
 * Which `/api/files/*` requests the worker may serve without a JWT.
 *
 * Quiz media (`MediaEditor`) uploads with `scope: 'app'`, and the SDK
 * documents that scope as publicly readable: the URL the upload returns is
 * meant to be dropped straight into an `<img>` / `<video>` / `<audio>` src.
 * A browser never attaches an `Authorization` header when it fetches those,
 * so a keyed app-scope GET has to survive without auth or every uploaded
 * image, video and audio clip renders broken with a 401.
 *
 * Everything else stays authenticated. The exclusions below are load-bearing
 * rather than cautious, because of how the platform resolves a scope into an
 * R2 prefix:
 *
 *   scope 'app'  -> `apps/<resourceId>/`
 *   scope 'self' -> `apps/<resourceId>/users/<userId>/`   (needs a userId)
 *
 * and the download guard is `key.startsWith(prefix)`.
 *
 *  - Per-user keys are strict DESCENDANTS of the app prefix, so a request
 *    that says `?scope=app` while naming a known user key passes the
 *    platform's prefix check. Refusing the `users/` namespace to anonymous
 *    callers is what actually keeps scope-self files private.
 *  - An empty key path is the LIST route, and `?prefix=users/` lists every
 *    user's keys. Anonymous listing would hand out exactly the keys the rule
 *    above exists to protect.
 *  - The `users/` test runs on the DECODED key, because an encoded slash
 *    (`%2Fusers%2F`) or an encoded letter (`%75sers`) survives URL parsing
 *    intact and only becomes a path segment once decoded.
 *
 * Dot segments are also refused. That one is belt-and-braces rather than
 * load-bearing: WHATWG URL parsing already collapses `..`, `.` and their
 * percent-encoded spellings out of `url.pathname` before this sees them, and
 * the platform rejects them again downstream. It costs one comparison and
 * keeps the function honest if it is ever handed a raw, unparsed path.
 *
 * Mutations (upload, multipart, delete) are never anonymous: an app-scope
 * write is not namespaced per user, so an unauthenticated writer could fill
 * or overwrite the app's shared media.
 */

const FILES_MOUNT = '/api/files'

/** The per-user namespace the platform nests under the app prefix. */
const USER_NAMESPACE_SEGMENT = 'users'

/**
 * The R2 key a `/api/files/...` URL names, or `null` when the path is not on
 * this mount or cannot be decoded.
 *
 * Mirrors the platform's own decoding (`decodeURIComponent` of the path minus
 * the mount) so this check sees the same string the prefix guard downstream
 * will see — a percent-encoded `%75sers/` must not read as anything else here.
 * An empty string means the mount root, i.e. the list route.
 */
export function fileKeyFromPath(pathname: string): string | null {
  if (pathname !== FILES_MOUNT && !pathname.startsWith(`${FILES_MOUNT}/`)) return null
  try {
    return decodeURIComponent(pathname.slice(FILES_MOUNT.length).replace(/^\//, ''))
  } catch {
    return null
  }
}

/**
 * True when `method` + `pathname` + query describe a public app-scope media
 * read that is safe to forward with no user identity attached.
 */
export function isPublicFileRead(
  method: string,
  pathname: string,
  params: URLSearchParams,
): boolean {
  if (method !== 'GET') return false
  if (params.get('scope') !== 'app') return false

  const key = fileKeyFromPath(pathname)
  // `null` = not this mount; `''` = the list route.
  if (!key) return false

  const segments = key.split('/')
  if (segments.some((s) => s === '' || s === '.' || s === '..')) return false
  if (segments.includes(USER_NAMESPACE_SEGMENT)) return false

  return true
}
