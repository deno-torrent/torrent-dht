/**
 * Node 类测试
 */
import { assertEquals, assertNotEquals } from '@std/assert'
import Node from '../src/node.ts'
import Id from '../src/id.ts'
import { sha1 } from '../src/util/hash.ts'
import { COMPAT_NODE_LEN } from '../src/util/net.ts'

function makeNode(addr = '10.0.0.1', port = 6881): Node {
  const id = Id.fromUnit8Array(sha1(new TextEncoder().encode(addr + port)))
  return new Node(id, port, addr)
}

// ─── 构造函数 ─────────────────────────────────────────────────────────────────

Deno.test('Node - 构造后 id、addr、port 正确', () => {
  const id = Id.random()
  const node = new Node(id, 6881, '1.2.3.4')
  assertEquals(node.id.toString(), id.toString())
  assertEquals(node.port, 6881)
  assertEquals(node.addr, '1.2.3.4')
})

// ─── isActive / updateActivedAt ──────────────────────────────────────────────

Deno.test('Node.isActive - 新建节点为活跃状态', () => {
  assertEquals(makeNode().isActive(), true)
})

Deno.test('Node.updateActivedAt - 更新后 activedAt 不早于之前', () => {
  const node = makeNode()
  const before = node.activedAt
  node.updateActivedAt()
  assertEquals(node.activedAt >= before, true)
})

// ─── update ──────────────────────────────────────────────────────────────────

Deno.test('Node.update - 更新地址和端口后值正确', () => {
  const node = makeNode('1.1.1.1', 1111)
  node.update(2222, '2.2.2.2')
  assertEquals(node.addr, '2.2.2.2')
  assertEquals(node.port, 2222)
})

Deno.test('Node.update - 更新后节点仍处于活跃状态', () => {
  const node = makeNode('3.3.3.3', 3333)
  node.update(4444, '4.4.4.4')
  assertEquals(node.isActive(), true)
})

// ─── toCompact / fromCompact ─────────────────────────────────────────────────

Deno.test('Node.toCompact - 返回 26 字节', () => {
  assertEquals(makeNode().toCompact().length, COMPAT_NODE_LEN)
})

Deno.test('Node.toCompact / Node.fromCompact - 往返转换', () => {
  const original = makeNode('10.20.30.40', 12345)
  const compact = original.toCompact()
  const restored = Node.fromCompact(compact)
  assertEquals(restored.id.toString(), original.id.toString())
  assertEquals(restored.addr, original.addr)
  assertEquals(restored.port, original.port)
})

Deno.test('Node.fromCompact - 不同数据产生不同节点', () => {
  const n1 = makeNode('1.1.1.1', 1000)
  const n2 = makeNode('2.2.2.2', 2000)
  assertNotEquals(Node.fromCompact(n1.toCompact()).id.toString(), Node.fromCompact(n2.toCompact()).id.toString())
})

// ─── toString ────────────────────────────────────────────────────────────────

Deno.test('Node.toString - 包含 id、addr、port', () => {
  const node = makeNode('5.6.7.8', 9999)
  const str = node.toString()
  assertEquals(str.includes(node.id.toString()), true)
  assertEquals(str.includes('5.6.7.8'), true)
  assertEquals(str.includes('9999'), true)
})
