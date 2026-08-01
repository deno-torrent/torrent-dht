const VERSION_PATTERN = /"version"\s*:\s*"([^"]+)"/

/** Return the configured package version or throw when it cannot be determined. */
export function readConfiguredVersion(configText: string): string {
  const match = VERSION_PATTERN.exec(configText)
  if (!match?.[1]) throw new Error('deno.jsonc does not contain a version string')
  return match[1]
}

/** Require a `v`-prefixed release tag to match the package version. */
export function verifyReleaseVersion(configText: string, releaseTag: string): string {
  if (!releaseTag) throw new TypeError('release tag is required')
  if (!releaseTag.startsWith('v')) throw new Error('release tag must use a v prefix')

  const version = readConfiguredVersion(configText)
  const tagVersion = releaseTag.slice(1)
  if (tagVersion !== version) {
    throw new Error(`release tag ${releaseTag} does not match deno.jsonc version ${version}`)
  }

  return version
}

if (import.meta.main) {
  const configUrl = new URL('../deno.jsonc', import.meta.url)
  const version = verifyReleaseVersion(await Deno.readTextFile(configUrl), Deno.args[0] ?? '')
  console.log(`release tag matches package version ${version}`)
}
