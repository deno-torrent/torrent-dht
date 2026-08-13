/**
 * InfoHashManager 测试
 */
import { assertEquals } from '@std/assert'
import InfoHashManager from '../src/info_hash_manager.ts'
import Peer from '../src/peer.ts'

const mgr = new InfoHashManager()
const tokenBytes = (value: string): Uint8Array => new TextEncoder().encode(value)

// ─── add / find ───────────────────────────────────────────────────────────────

Deno.test('InfoHashManager.add / find - 添加后可查询到 Peer', () => {
  const hash = 'aabbccddeeff00112233445566778899aabbccdd'
  const peer = new Peer(6881, '1.2.3.4')
  const token = tokenBytes('token1')

  mgr.add(hash, peer, token)
  const result = mgr.find(hash)
  assertEquals(result !== undefined, true)
  assertEquals(result!.length, 1)
})

Deno.test('InfoHashManager.findToken - 返回对应的 token', () => {
  const hash = 'bbccddeeff00112233445566778899aabbccddee'
  const peer = new Peer(7000, '9.8.7.6')
  const token = tokenBytes('my-token')

  mgr.add(hash, peer, token)
  assertEquals(mgr.findToken(hash), token)
})

Deno.test('InfoHashManager.add - 接受不同响应节点为同一 info hash 返回的不同 token', () => {
  const hash = 'cccccccccccccccccccccccccccccccccccccccc'
  const peer1 = new Peer(1111, '1.1.1.1')
  const peer2 = new Peer(2222, '2.2.2.2')

  mgr.add(hash, peer1, tokenBytes('token-a'))
  mgr.add(hash, peer2, tokenBytes('token-b'))

  const result = mgr.find(hash)
  assertEquals(result!.length, 2)
})

Deno.test('InfoHashManager.addList - 批量添加 Peer', () => {
  const hash = 'dddddddddddddddddddddddddddddddddddddddd'
  const peers = [new Peer(100, '10.0.0.1'), new Peer(200, '10.0.0.2'), new Peer(300, '10.0.0.3')]

  mgr.addList(hash, peers, tokenBytes('list-token'))
  const result = mgr.find(hash)
  assertEquals(result!.length, 3)
})

Deno.test('InfoHashManager.add - 相同 endpoint 刷新而不重复占用容量', () => {
  const hash = 'abababababababababababababababababababab'
  mgr.add(hash, new Peer(6881, '192.0.2.1'), tokenBytes('dedupe-token'))
  mgr.add(hash, new Peer(6881, '192.0.2.1'), tokenBytes('dedupe-token'))

  assertEquals(mgr.find(hash)?.length, 1)
})

// ─── find 不存在的 hash ────────────────────────────────────────────────────────

Deno.test('InfoHashManager.find - 不存在的 hash 返回 undefined', () => {
  const result = mgr.find('eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee')
  assertEquals(result, undefined)
})

// ─── remove ───────────────────────────────────────────────────────────────────

Deno.test('InfoHashManager.remove - 删除后查询返回 undefined', () => {
  const hash = 'ffffffffffffffffffffffffffffffffffffffff'
  mgr.add(hash, new Peer(9999, '3.3.3.3'), tokenBytes('rm-token'))
  mgr.remove(hash)
  assertEquals(mgr.find(hash), undefined)
  assertEquals(mgr.findToken(hash), undefined)
})

// ─── findToken 不存在 ──────────────────────────────────────────────────────────

Deno.test('InfoHashManager.findToken - 不存在的 hash 返回 undefined', () => {
  assertEquals(mgr.findToken('0000000000000000000000000000000000000000'), undefined)
})

// ─── remove 不存在 ────────────────────────────────────────────────────────────

Deno.test('InfoHashManager.remove - 不存在的 hash 不抛出异常', () => {
  // 应安全跳过（内部记录 warn 日志）
  mgr.remove('1111111111111111111111111111111111111111')
})

// ─── peer 数量上限 ────────────────────────────────────────────────────────────

Deno.test('InfoHashManager.add - 超过每 hash 100 个 peer 上限后忽略新 peer', () => {
  const hash = '2222222222222222222222222222222222222222'
  const token = tokenBytes('limit-token')

  // 添加 101 个 peer，第 101 个应被忽略
  for (let i = 0; i < 101; i++) {
    mgr.add(hash, new Peer(i + 1, `${i}.0.0.1`), token)
  }

  const peers = mgr.find(hash)
  // 最多 100 个
  assertEquals(peers !== undefined && peers.length <= 100, true)
})

Deno.test('InfoHashManager.prune - 移除过期 peer 及其 token', () => {
  const hash = '3333333333333333333333333333333333333333'
  mgr.add(hash, new Peer(6881, '203.0.113.1'), tokenBytes('expiring-token'))

  const removed = mgr.prune(Date.now() + InfoHashManager.PEER_TTL_MS)
  assertEquals(removed > 0, true)
  assertEquals(mgr.find(hash), undefined)
  assertEquals(mgr.findToken(hash), undefined)
})
