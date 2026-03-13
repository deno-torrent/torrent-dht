/**
 * Peer 类测试
 */
import { assertEquals, assertThrows } from '@std/assert'
import Peer from '../src/peer.ts'

// ─── 构造函数 ─────────────────────────────────────────────────────────────────

Deno.test('Peer - 合法 IPv4 地址与端口', () => {
  const peer = new Peer(6881, '192.168.1.1')
  assertEquals(peer.addr, '192.168.1.1')
  assertEquals(peer.port, 6881)
  assertEquals(peer.addrType, 'ipv4')
})

Deno.test('Peer - 非法 IP 地址抛出异常', () => {
  assertThrows(() => new Peer(6881, '999.999.999.999'))
})

Deno.test('Peer - 端口超出范围抛出异常', () => {
  assertThrows(() => new Peer(65536, '192.168.1.1'))
  assertThrows(() => new Peer(-1, '192.168.1.1'))
})

Deno.test('Peer - 端口 0 合法', () => {
  const peer = new Peer(0, '1.2.3.4')
  assertEquals(peer.port, 0)
})

Deno.test('Peer - 端口 65535 合法', () => {
  const peer = new Peer(65535, '1.2.3.4')
  assertEquals(peer.port, 65535)
})

// ─── 紧凑格式 ─────────────────────────────────────────────────────────────────

Deno.test('Peer.toCompact / Peer.fromCompact - 往返转换', () => {
  const original = new Peer(12345, '10.0.0.1')
  const compact = original.toCompact()
  assertEquals(compact.length, 6)

  const restored = Peer.fromCompact(compact)
  assertEquals(restored.addr, original.addr)
  assertEquals(restored.port, original.port)
})

// ─── update ───────────────────────────────────────────────────────────────────

Deno.test('Peer.update - 更新地址和端口', () => {
  const peer = new Peer(1234, '1.1.1.1')
  peer.update(5678, '2.2.2.2')
  assertEquals(peer.addr, '2.2.2.2')
  assertEquals(peer.port, 5678)
})

// ─── toString ─────────────────────────────────────────────────────────────────

Deno.test('Peer.toString - 包含地址和端口', () => {
  const peer = new Peer(6881, '192.168.0.1')
  const str = peer.toString()
  assertEquals(str.includes('192.168.0.1'), true)
  assertEquals(str.includes('6881'), true)
})
