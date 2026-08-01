import { assertEquals, assertThrows } from '@std/assert'
import { readConfiguredVersion, verifyReleaseVersion } from '../scripts/verify_version.ts'

const CONFIG = `{
  // JSONC comments are permitted
  "name": "@scope/package",
  "version": "2.0.0"
}`

Deno.test('readConfiguredVersion - reads the sole JSONC version field', () => {
  assertEquals(readConfiguredVersion(CONFIG), '2.0.0')
})

Deno.test('verifyReleaseVersion - accepts the conventional v tag prefix', () => {
  assertEquals(verifyReleaseVersion(CONFIG, 'v2.0.0'), '2.0.0')
})

Deno.test('verifyReleaseVersion - rejects unprefixed tags and mismatches', () => {
  assertThrows(() => verifyReleaseVersion(CONFIG, '2.0.0'), Error, 'must use a v prefix')
  assertThrows(() => verifyReleaseVersion(CONFIG, 'v2.0.1'), Error, 'does not match')
})

Deno.test('verifyReleaseVersion - rejects missing metadata', () => {
  assertThrows(() => verifyReleaseVersion('{}', 'v2.0.0'), Error, 'does not contain')
  assertThrows(() => verifyReleaseVersion(CONFIG, ''), TypeError, 'required')
})
