import { assertEquals, assertNotEquals } from '@std/assert'
import TokenManager from '../src/krpc/token_manager.ts'

function deterministicSecrets(): () => Uint8Array {
  let value = 0
  return () => new Uint8Array(32).fill(++value)
}

Deno.test('TokenManager - token is stable within one interval and bound to an IP', () => {
  const manager = new TokenManager({ now: () => 0, secretFactory: deterministicSecrets() })
  const token = manager.issue('192.0.2.1')

  assertEquals(manager.issue('192.0.2.1'), token)
  assertEquals(manager.validate(token, '192.0.2.1'), true)
  assertEquals(manager.validate(token, '192.0.2.2'), false)
  assertNotEquals(manager.issue('192.0.2.2'), token)
})

Deno.test('TokenManager - accepts only the immediately previous rotation window', () => {
  let now = 0
  const manager = new TokenManager({
    rotationIntervalMs: 100,
    now: () => now,
    secretFactory: deterministicSecrets(),
  })
  const original = manager.issue('192.0.2.1')

  now = 100
  const rotated = manager.issue('192.0.2.1')
  assertNotEquals(rotated, original)
  assertEquals(manager.validate(original, '192.0.2.1'), true)

  now = 200
  manager.issue('192.0.2.1')
  assertEquals(manager.validate(original, '192.0.2.1'), false)
})

Deno.test('TokenManager - a long idle period expires all old tokens', () => {
  let now = 0
  const manager = new TokenManager({
    rotationIntervalMs: 100,
    now: () => now,
    secretFactory: deterministicSecrets(),
  })
  const token = manager.issue('192.0.2.1')

  now = 1_000
  assertEquals(manager.validate(token, '192.0.2.1'), false)
})
