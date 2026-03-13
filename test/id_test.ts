/**
 * Id 类测试
 */
import { assertEquals, assertNotEquals, assertThrows } from '@std/assert'
import Id from '../src/id.ts'
import { sha1 } from '../src/util/hash.ts'

// ─── 构造与工厂方法 ───────────────────────────────────────────────────────────

Deno.test('Id.fromUnit8Array - 从 20 字节创建', () => {
  const bytes = sha1(new TextEncoder().encode('hello'))
  const id = Id.fromUnit8Array(bytes)
  assertEquals(id.bits.bytes.length, 20)
})

Deno.test('Id.fromUnit8Array - 非 20 字节抛出异常', () => {
  assertThrows(() => {
    Id.fromUnit8Array(new Uint8Array(10))
  })
})

Deno.test('Id.random - 返回有效 ID', () => {
  const id = Id.random()
  assertEquals(id.bits.bytes.length, 20)
})

Deno.test('Id.random - 两次调用结果不同', () => {
  const id1 = Id.random()
  const id2 = Id.random()
  assertNotEquals(id1.toString(), id2.toString())
})

// ─── 静态方法 ─────────────────────────────────────────────────────────────────

Deno.test('Id.isValidId - 20 字节有效', () => {
  const bytes = new Uint8Array(20)
  assertEquals(Id.isValidId(bytes), true)
})

Deno.test('Id.isValidId - 非 20 字节无效', () => {
  assertEquals(Id.isValidId(new Uint8Array(10)), false)
  assertEquals(Id.isValidId(new Uint8Array(21)), false)
  assertEquals(Id.isValidId(undefined), false)
})

// ─── 实例方法 ─────────────────────────────────────────────────────────────────

Deno.test('Id.equals - 相同内容返回 true', () => {
  const bytes = sha1(new TextEncoder().encode('equal-test'))
  const id1 = Id.fromUnit8Array(bytes)
  const id2 = Id.fromUnit8Array(bytes)
  assertEquals(id1.equals(id2), true)
})

Deno.test('Id.equals - 不同内容返回 false', () => {
  const id1 = Id.fromUnit8Array(sha1(new TextEncoder().encode('a')))
  const id2 = Id.fromUnit8Array(sha1(new TextEncoder().encode('b')))
  assertEquals(id1.equals(id2), false)
})

Deno.test('Id.toString - 返回 40 字符十六进制字符串', () => {
  const id = Id.random()
  assertEquals(id.toString().length, 40)
  assertEquals(/^[0-9a-f]{40}$/.test(id.toString()), true)
})

Deno.test('Id.toBinaryString - 返回 160 位二进制字符串', () => {
  const id = Id.random()
  assertEquals(id.toBinaryString().length, 160)
  assertEquals(/^[01]{160}$/.test(id.toBinaryString()), true)
})

Deno.test('Id 常量 - BYTES_LENGTH 为 20，BIT_LENGTH 为 160', () => {
  assertEquals(Id.BYTES_LENGTH, 20)
  assertEquals(Id.BIT_LENGTH, 160)
})

Deno.test('Id.toIntSting - 返回非空十进制整数字符串', () => {
  const id = Id.fromUnit8Array(sha1(new TextEncoder().encode('int-string-test')))
  const str = id.toIntSting()
  // 应为纯数字字符串（非空、非负）
  assertEquals(typeof str, 'string')
  assertEquals(str.length > 0, true)
  assertEquals(/^\d+$/.test(str), true)
})
