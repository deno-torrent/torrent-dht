/**
 * 紧凑地址 / 节点编解码工具测试
 */
import { assertEquals, assertThrows } from '@std/assert'
import {
  COMPAT_ADDR_V4_LEN,
  COMPAT_NODE_LEN,
  extractCompactAddr,
  extractCompactNode,
  packageCompactAddr,
  packageCompactNode,
} from '../src/util/net.ts'
import Id from '../src/id.ts'
import { sha1 } from '../src/util/hash.ts'

// ─── 常量 ───────────────────────────────────────────────────────────────────

Deno.test('COMPAT_ADDR_V4_LEN 为 6', () => {
  assertEquals(COMPAT_ADDR_V4_LEN, 6)
})

Deno.test('COMPAT_NODE_LEN 为 26', () => {
  assertEquals(COMPAT_NODE_LEN, 26)
})

// ─── IPv4 紧凑地址 ────────────────────────────────────────────────────────────

Deno.test('packageCompactAddr / extractCompactAddr - 往返转换 192.168.1.1:6881', () => {
  const addr = '192.168.1.1'
  const port = 6881
  const compact = packageCompactAddr(addr, port)
  assertEquals(compact.length, COMPAT_ADDR_V4_LEN)

  const result = extractCompactAddr(compact)
  assertEquals(result.addr, addr)
  assertEquals(result.port, port)
})

Deno.test('packageCompactAddr / extractCompactAddr - 往返转换 10.0.0.1:80', () => {
  const addr = '10.0.0.1'
  const port = 80
  const compact = packageCompactAddr(addr, port)
  const result = extractCompactAddr(compact)
  assertEquals(result.addr, addr)
  assertEquals(result.port, port)
})

Deno.test('extractCompactAddr - 字节长度不为 6 时抛出异常', () => {
  assertThrows(() => {
    extractCompactAddr(new Uint8Array(4))
  })
})

// ─── 紧凑节点 ─────────────────────────────────────────────────────────────────

Deno.test('packageCompactNode / extractCompactNode - 往返转换', () => {
  const idBytes = sha1(new TextEncoder().encode('test-node-id'))
  const id = Id.fromUnit8Array(idBytes)
  const addr = '192.168.0.1'
  const port = 12345

  const compact = packageCompactNode(id, addr, port)
  assertEquals(compact.length, COMPAT_NODE_LEN)

  const result = extractCompactNode(compact)
  assertEquals(result.id.toString(), id.toString())
  assertEquals(result.addr, addr)
  assertEquals(result.port, port)
})

Deno.test('extractCompactNode - 字节长度不为 26 时抛出异常', () => {
  assertThrows(() => {
    extractCompactNode(new Uint8Array(20))
  })
})

// ─── isAddr ───────────────────────────────────────────────────────────────────

import { isAddr } from '../src/util/net.ts'

Deno.test('isAddr - 有效 IPv4 地址返回 true', () => {
  assertEquals(isAddr('192.168.1.1'), true)
  assertEquals(isAddr('0.0.0.0'), true)
  assertEquals(isAddr('255.255.255.255'), true)
})

Deno.test('isAddr - 有效域名返回 true', () => {
  assertEquals(isAddr('router.bittorrent.com'), true)
  assertEquals(isAddr('dht.transmissionbt.com'), true)
})

Deno.test('isAddr - 无效输入返回 false', () => {
  assertEquals(isAddr(''), false)
  assertEquals(isAddr('not-an-address!!'), false)
  assertEquals(isAddr('999.999.999.999'), false)
})
