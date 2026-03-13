/**
 * sha1 哈希工具函数测试
 */
import { assertEquals, assertNotEquals } from '@std/assert'
import { randomSha1, randomSha1String, sha1, sha1String } from '../src/util/hash.ts'

Deno.test('sha1 - 返回 20 字节哈希', () => {
  const data = new TextEncoder().encode('hello')
  const hash = sha1(data)
  assertEquals(hash.length, 20)
})

Deno.test('sha1 - 相同输入产生相同哈希', () => {
  const data = new TextEncoder().encode('hello world')
  const hash1 = sha1(data)
  const hash2 = sha1(data)
  assertEquals(hash1, hash2)
})

Deno.test('sha1 - 不同输入产生不同哈希', () => {
  const hash1 = sha1(new TextEncoder().encode('foo'))
  const hash2 = sha1(new TextEncoder().encode('bar'))
  assertNotEquals(hash1, hash2)
})

Deno.test('sha1 - 空输入产生固定哈希', () => {
  const hash = sha1(new Uint8Array(0))
  assertEquals(hash.length, 20)
  // SHA-1("") = da39a3ee5e6b4b0d3255bfef95601890afd80709
  const expected = 'da39a3ee5e6b4b0d3255bfef95601890afd80709'
  assertEquals(sha1String(new Uint8Array(0)), expected)
})

Deno.test('sha1String - 返回 40 字符十六进制字符串', () => {
  const hex = sha1String(new TextEncoder().encode('hello'))
  assertEquals(hex.length, 40)
  // 验证只含十六进制字符
  assertEquals(/^[0-9a-f]{40}$/.test(hex), true)
})

Deno.test('randomSha1 - 返回 20 字节', () => {
  const hash = randomSha1()
  assertEquals(hash.length, 20)
})

Deno.test('randomSha1 - 两次调用结果不同（极高概率）', () => {
  const h1 = randomSha1()
  const h2 = randomSha1()
  // 两个随机值相等的概率可忽略不计（1/2^160）
  assertNotEquals(h1, h2)
})

Deno.test('randomSha1String - 返回 40 字符十六进制字符串', () => {
  const hex = randomSha1String()
  assertEquals(hex.length, 40)
  assertEquals(/^[0-9a-f]{40}$/.test(hex), true)
})
