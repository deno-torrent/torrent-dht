/**
 * Bucket（K-桶）测试
 */
import { assertEquals, assertNotEquals, assertThrows } from '@std/assert'
import { BitArray } from '@deno-torrent/toolkit'
import Bucket from '../src/bucket.ts'
import Id from '../src/id.ts'
import Node from '../src/node.ts'
import { sha1 } from '../src/util/hash.ts'

// ─── 辅助函数 ─────────────────────────────────────────────────────────────────

function makeNode(seed: string, port = 6881, addr = '1.2.3.4'): Node {
  const idBytes = sha1(new TextEncoder().encode(seed))
  return new Node(Id.fromUnit8Array(idBytes), port, addr)
}

function makeFullRangeBucket(capacity = 8): Bucket {
  const start = BitArray.fromBinaryString('0'.repeat(160))
  const end = BitArray.fromBinaryString('1'.repeat(160))
  return new Bucket(capacity, start, end)
}

// ─── 构造函数验证 ─────────────────────────────────────────────────────────────

Deno.test('Bucket - 容量为 0 抛出异常', () => {
  const start = BitArray.fromBinaryString('0'.repeat(160))
  const end = BitArray.fromBinaryString('1'.repeat(160))
  assertThrows(() => new Bucket(0, start, end))
})

Deno.test('Bucket - start > end 抛出异常', () => {
  const start = BitArray.fromBinaryString('1'.repeat(160))
  const end = BitArray.fromBinaryString('0'.repeat(160))
  assertThrows(() => new Bucket(8, start, end))
})

// ─── 基本属性 ─────────────────────────────────────────────────────────────────

Deno.test('Bucket - 初始为空', () => {
  const bucket = makeFullRangeBucket()
  assertEquals(bucket.isEmpty(), true)
  assertEquals(bucket.size, 0)
})

Deno.test('Bucket.withinRange - 全范围桶包含所有 ID', () => {
  const bucket = makeFullRangeBucket()
  const node = makeNode('range-test')
  assertEquals(bucket.withinRange(node.id), true)
})

// ─── add / remove ─────────────────────────────────────────────────────────────

Deno.test('Bucket.add - 添加节点成功', () => {
  const bucket = makeFullRangeBucket()
  const node = makeNode('add-test')
  assertEquals(bucket.add(node), true)
  assertEquals(bucket.size, 1)
})

Deno.test('Bucket.add - 重复添加同 ID 节点更新信息并返回 false', () => {
  const bucket = makeFullRangeBucket()
  const node1 = makeNode('dup-test', 1111, '1.1.1.1')
  const node2 = makeNode('dup-test', 2222, '2.2.2.2')
  assertEquals(bucket.add(node1), true)
  assertEquals(bucket.add(node2), false) // 已存在
  assertEquals(bucket.size, 1)
  // 地址应被更新为 node2 的信息
  assertEquals(bucket.latest!.addr, '2.2.2.2')
})

Deno.test('Bucket.add - 满桶时淘汰最旧节点', () => {
  const bucket = makeFullRangeBucket(3) // 容量 3
  bucket.add(makeNode('n1'))
  bucket.add(makeNode('n2'))
  bucket.add(makeNode('n3'))
  assertEquals(bucket.isFull(), true)

  const oldOldest = bucket.oldest
  bucket.add(makeNode('n4')) // 应淘汰最旧节点
  assertEquals(bucket.size, 3)
  // 最旧节点应已被移除
  assertEquals(bucket.nodes.some((n) => n.id.equals(oldOldest!.id)), false)
})

Deno.test('Bucket.remove - 移除存在的节点', () => {
  const bucket = makeFullRangeBucket()
  const node = makeNode('remove-test')
  bucket.add(node)
  assertEquals(bucket.remove(node), true)
  assertEquals(bucket.size, 0)
})

Deno.test('Bucket.remove - 移除不存在的节点返回 false', () => {
  const bucket = makeFullRangeBucket()
  assertEquals(bucket.remove(makeNode('not-exist')), false)
})

// ─── obtainNodes / closestNodes ───────────────────────────────────────────────

Deno.test('Bucket.obtainNodes - 返回指定数量的节点', () => {
  const bucket = makeFullRangeBucket()
  for (let i = 0; i < 5; i++) bucket.add(makeNode(`obtain-${i}`))
  assertEquals(bucket.obtainNodes(3).length, 3)
  assertEquals(bucket.obtainNodes(10).length, 5) // 不超过实际数量
})

Deno.test('Bucket.closestNodes - 返回 XOR 距离最近的节点', () => {
  const bucket = makeFullRangeBucket()
  for (let i = 0; i < 5; i++) bucket.add(makeNode(`closest-${i}`))
  const target = makeNode('target')
  const result = bucket.closestNodes(target.id, 3)
  assertEquals(result.length, 3)
})

// ─── oldest / latest ─────────────────────────────────────────────────────────

Deno.test('Bucket.latest 指向最近添加的节点，oldest 指向最旧节点', () => {
  const bucket = makeFullRangeBucket()
  const first = makeNode('first')
  const second = makeNode('second')
  bucket.add(first)
  bucket.add(second)
  assertEquals(bucket.latest!.id.equals(second.id), true)
  assertEquals(bucket.oldest!.id.equals(first.id), true)
})

// ─── 边界条件 ─────────────────────────────────────────────────────────────────

Deno.test('Bucket.oldest / latest - 空桶时返回 undefined', () => {
  const bucket = makeFullRangeBucket()
  assertEquals(bucket.oldest, undefined)
  assertEquals(bucket.latest, undefined)
})

Deno.test('Bucket.withinRange - 部分范围桶不包含范围外的 ID', () => {
  // 仅覆盖最低两个值的窄桶：[0…0, 0…1]
  const start = BitArray.fromBinaryString('0'.repeat(160))
  const end = BitArray.fromBinaryString('0'.repeat(159) + '1')
  const narrowBucket = new Bucket(8, start, end)

  // 全 0 的 ID 在范围内
  const allZeros = Id.fromUnit8Array(new Uint8Array(20).fill(0x00))
  assertEquals(narrowBucket.withinRange(allZeros), true)

  // 全 1 的 ID 绝对在范围外
  const allOnes = Id.fromUnit8Array(new Uint8Array(20).fill(0xff))
  assertEquals(narrowBucket.withinRange(allOnes), false)
})

Deno.test('Bucket.obtainNodes - count=0 返回空数组', () => {
  const bucket = makeFullRangeBucket()
  bucket.add(makeNode('obtainzero-node'))
  assertEquals(bucket.obtainNodes(0).length, 0)
})

Deno.test('Bucket.closestNodes - count 超过节点总数时返回全部节点', () => {
  const bucket = makeFullRangeBucket()
  for (let i = 0; i < 3; i++) bucket.add(makeNode(`over-count-${i}`))
  const target = makeNode('over-count-target')
  // 请求 100 个，但桶中只有 3 个
  assertEquals(bucket.closestNodes(target.id, 100).length, 3)
})

Deno.test('Bucket - start/end 位长度不为 160 时构造抛出异常', () => {
  const bad80 = BitArray.fromBinaryString('0'.repeat(80))
  const good160 = BitArray.fromBinaryString('0'.repeat(160))
  assertThrows(() => new Bucket(8, bad80, good160))
})
