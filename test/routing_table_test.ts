/**
 * RoutingTable（路由表）测试
 *
 * 注意：RoutingTable 是单例，测试文件中只初始化一次，所有测试共享同一实例。
 */
import { assertEquals } from '@std/assert'
import Id from '../src/id.ts'
import LocalNode from '../src/local_node.ts'
import Node from '../src/node.ts'
import RoutingTable from '../src/routing_table.ts'
import { sha1 } from '../src/util/hash.ts'

// ─── 辅助函数 ─────────────────────────────────────────────────────────────────

function makeNode(seed: string, port = 6881, addr = '1.2.3.4'): Node {
  return new Node(Id.fromUnit8Array(sha1(new TextEncoder().encode(seed))), port, addr)
}

// ─── 初始化 ───────────────────────────────────────────────────────────────────

// 创建用于测试的本地节点（使用固定 ID）
const localIdBytes = sha1(new TextEncoder().encode('local-node-fixed-id'))
const localId = Id.fromUnit8Array(localIdBytes)
const localNode = new LocalNode(localId, 16666, '127.0.0.1')

// 初始化路由表（单例，整个测试文件只调用一次）
const rt = new RoutingTable(localNode)

// ─── get / init 单例 ──────────────────────────────────────────────────────────

Deno.test('RoutingTable - instances keep routing state isolated', () => {
  const other = new RoutingTable(new LocalNode(Id.random(), 16667, '127.0.0.2'))
  other.add(makeNode('isolated-node'))
  assertEquals(other.nodeCount, 1)
  assertEquals(rt.findNode(other.getAllNodes()[0].id), undefined)
})

// ─── localNode ────────────────────────────────────────────────────────────────

Deno.test('RoutingTable.localNode - 返回正确的本地节点', () => {
  assertEquals(rt.localNode.id.equals(localId), true)
})

// ─── buckets ─────────────────────────────────────────────────────────────────

Deno.test('RoutingTable.buckets - 初始化后生成 160 个桶（BEP-5 标准）', () => {
  assertEquals(rt.buckets.length, 160)
})

// ─── add / nodeCount / remove ─────────────────────────────────────────────────

Deno.test('RoutingTable.add - 成功添加节点并计入 nodeCount', () => {
  const before = rt.nodeCount
  const node = makeNode('rt-add-test')
  rt.add(node)
  assertEquals(rt.nodeCount, before + 1)
})

Deno.test('RoutingTable - exposes and explicitly replaces a full-bucket candidate', () => {
  const previousCapacity = RoutingTable.BUCKET_CAPACITY
  RoutingTable.BUCKET_CAPACITY = 1
  try {
    const local = new LocalNode(Id.random(), 16668, '127.0.0.3')
    const table = new RoutingTable(local)
    const first = local.id.bits.bytes[0] & 0x80 ? 0x00 : 0x80
    const firstBytes = new Uint8Array(20)
    firstBytes[0] = first
    const secondBytes = firstBytes.slice()
    secondBytes[19] = 1
    const oldest = new Node(Id.fromUnit8Array(firstBytes), 7001, '192.0.2.1')
    const replacement = new Node(Id.fromUnit8Array(secondBytes), 7002, '192.0.2.2')

    assertEquals(table.add(oldest), true)
    assertEquals(table.add(replacement), false)
    assertEquals(table.replacementCandidate(replacement)?.id.equals(oldest.id), true)
    assertEquals(table.replace(oldest, replacement), true)
    assertEquals(table.findNode(oldest.id), undefined)
    assertEquals(table.findNode(replacement.id) !== undefined, true)
  } finally {
    RoutingTable.BUCKET_CAPACITY = previousCapacity
  }
})

Deno.test('RoutingTable.remove - 移除已存在节点', () => {
  const node = makeNode('rt-remove-test', 7777, '5.5.5.5')
  rt.add(node)
  const before = rt.nodeCount
  rt.remove(node)
  assertEquals(rt.nodeCount, before - 1)
})

Deno.test('RoutingTable.removeByNodeId - 按 ID 移除', () => {
  const node = makeNode('rt-remove-by-id', 8888, '6.6.6.6')
  rt.add(node)
  const before = rt.nodeCount
  rt.removeByNodeId(node.id)
  assertEquals(rt.nodeCount, before - 1)
})

Deno.test('RoutingTable.removeByIp - 按 IP 移除', () => {
  const node = makeNode('rt-remove-by-ip', 9999, '7.7.7.7')
  rt.add(node)
  const before = rt.nodeCount
  rt.removeByIp('7.7.7.7')
  assertEquals(rt.nodeCount, before - 1)
})

// ─── getAllNodes / findNode / findClosestNodes ─────────────────────────────────

Deno.test('RoutingTable.getAllNodes - 返回所有已知节点', () => {
  const count = rt.getAllNodes().length
  assertEquals(count, rt.nodeCount)
})

Deno.test('RoutingTable.findNode - 找到已存在节点', () => {
  const node = makeNode('rt-find-test', 11111, '8.8.8.8')
  rt.add(node)
  const found = rt.findNode(node.id)
  assertEquals(found !== undefined, true)
  assertEquals(found!.id.equals(node.id), true)
})

Deno.test('RoutingTable.findNode - 不存在节点返回 undefined', () => {
  const randomId = Id.random()
  assertEquals(rt.findNode(randomId), undefined)
})

Deno.test('RoutingTable.findClosestNodes - 返回不超过指定数量的节点', () => {
  const target = Id.random()
  const result = rt.findClosestNodes(target, 5)
  assertEquals(result.length <= 5, true)
})

// ─── addNodes / removeNodes ───────────────────────────────────────────────────

Deno.test('RoutingTable.addNodes / removeNodes - 批量操作', () => {
  const nodes = ['batch1', 'batch2', 'batch3'].map((s) => makeNode(s, 1000, '9.9.9.9'))
  rt.addNodes(nodes)
  const beforeRemove = rt.nodeCount
  rt.removeNodes(nodes)
  assertEquals(rt.nodeCount, beforeRemove - nodes.length)
})

// ─── getRandomNode ────────────────────────────────────────────────────────────

Deno.test('RoutingTable.getRandomNode - 路由表非空时返回节点', () => {
  if (rt.nodeCount > 0) {
    assertEquals(rt.getRandomNode() !== undefined, true)
  }
})

// ─── removeClosestNode ────────────────────────────────────────────────────────

Deno.test('RoutingTable.removeClosestNode - 移除目标附近节点后节点数减少', () => {
  const n1 = makeNode('rc-node-1', 4001, '40.0.0.1')
  const n2 = makeNode('rc-node-2', 4002, '40.0.0.2')
  rt.add(n1)
  rt.add(n2)
  const target = makeNode('rc-target', 4000, '40.0.0.0')
  const before = rt.nodeCount
  rt.removeClosestNode(target)
  assertEquals(rt.nodeCount < before, true)
})

// ─── updateNode ───────────────────────────────────────────────────────────────

Deno.test('RoutingTable.updateNode - 更新已存在节点的地址和端口', () => {
  const node = makeNode('update-test', 5001, '50.0.0.1')
  rt.add(node)
  const updated = makeNode('update-test', 9999, '99.0.0.1') // 同 ID，不同 addr/port
  rt.updateNode(updated)
  const found = rt.findNode(node.id)
  assertEquals(found?.port, 9999)
  assertEquals(found?.addr, '99.0.0.1')
  rt.remove(found!) // 清理
})

// ─── removeByNodeId 不存在 ────────────────────────────────────────────────────

Deno.test('RoutingTable.removeByNodeId - 不存在的 ID 不影响节点数', () => {
  const before = rt.nodeCount
  rt.removeByNodeId(Id.random()) // 随机 ID 极大概率不存在
  assertEquals(rt.nodeCount, before)
})

// ─── removeByIp 多节点同 IP ────────────────────────────────────────────────────

Deno.test('RoutingTable.removeByIp - 同一 IP 的多个节点全部被移除', () => {
  const sharedIp = '222.222.222.222'
  const n1 = makeNode('shared-ip-1', 7001, sharedIp)
  const n2 = makeNode('shared-ip-2', 7002, sharedIp)
  rt.add(n1)
  rt.add(n2)
  const before = rt.nodeCount
  rt.removeByIp(sharedIp)
  assertEquals(rt.nodeCount, before - 2)
})

// ─── findClosestNodes 边界 ────────────────────────────────────────────────────

Deno.test('RoutingTable.findClosestNodes - count=1 最多返回 1 个节点', () => {
  // 确保路由表非空
  rt.add(makeNode('fc-single', 6001, '60.0.0.1'))
  const result = rt.findClosestNodes(Id.random(), 1)
  assertEquals(result.length, 1)
})

Deno.test('RoutingTable.findClosestNodes - count 超过总节点数时返回全部节点', () => {
  const total = rt.nodeCount
  const result = rt.findClosestNodes(Id.random(), total + 100)
  assertEquals(result.length, total)
})

// ─── getRandomNode 空表 ── 放在最后，清空路由表 ────────────────────────────────

Deno.test('RoutingTable.getRandomNode - 路由表清空后返回 undefined', () => {
  rt.getAllNodes().forEach((n) => rt.remove(n))
  assertEquals(rt.nodeCount, 0)
  assertEquals(rt.getRandomNode(), undefined)
})
