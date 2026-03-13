/**
 * ResponseHandler 测试
 *
 * ResponseHandler 处理来自其他节点的 KRPC 响应（ping / find_node / get_peers / announce_peer）。
 * 需要预先在 TransactionManager 中创建合法事务，模拟"我方发出过请求"的场景。
 */
import { assertEquals } from '@std/assert'
import { encodeHex } from '@std/encoding/hex'
import ResponseHandler from '../src/krpc/handler/response_handler.ts'
import TransactionManager from '../src/krpc/transaction_manager.ts'
import { MessageType, QueryType } from '../src/message_factory.ts'
import RoutingTable from '../src/routing_table.ts'
import InfoHashManager from '../src/info_hash_manager.ts'
import { makeInfoHash, makeLocalNode, makeNode, MockSender } from './fixtures.ts'
import { packageCompactNode } from '../src/util/net.ts'

const localNode = makeLocalNode('response-handler-test', 16001)
RoutingTable.init(localNode)

const mgr = TransactionManager.get()

const REMOTE_ADDR = '5.5.5.5'
const REMOTE_PORT = 8888
// 合法的 20 字节响应节点 ID
const RESP_NODE_ID = makeInfoHash('response-node')

// ─── TID 校验 ─────────────────────────────────────────────────────────────────

Deno.test('ResponseHandler - TID 不存在时静默丢弃消息', async () => {
  const handler = new ResponseHandler()
  const sender = new MockSender()
  await handler.handle(
    { t: 'ZZ', y: MessageType.RESPONSE, r: { id: RESP_NODE_ID } },
    REMOTE_ADDR,
    REMOTE_PORT,
    sender,
  )
  // 不应有任何出站消息
  assertEquals(sender.sentMessages.length, 0)
})

Deno.test('ResponseHandler - 响应中 node ID 缺失时静默丢弃', async () => {
  const handler = new ResponseHandler()
  const tid = mgr.create({ type: QueryType.PING, addr: REMOTE_ADDR, port: REMOTE_PORT })
  const sender = new MockSender()
  await handler.handle(
    { t: tid, y: MessageType.RESPONSE, r: { id: new Uint8Array(0) } },
    REMOTE_ADDR,
    REMOTE_PORT,
    sender,
  )
  assertEquals(sender.sentMessages.length, 0)
  // tid 仍可能已被 finish，不在此断言
})

// ─── ping 响应 ────────────────────────────────────────────────────────────────

Deno.test('ResponseHandler - ping 响应将节点加入路由表', async () => {
  const handler = new ResponseHandler()
  const tid = mgr.create({ type: QueryType.PING, addr: REMOTE_ADDR, port: REMOTE_PORT })
  const beforeCount = RoutingTable.get().nodeCount

  const sender = new MockSender()
  await handler.handle(
    { t: tid, y: MessageType.RESPONSE, r: { id: RESP_NODE_ID } },
    REMOTE_ADDR,
    REMOTE_PORT,
    sender,
  )
  assertEquals(RoutingTable.get().nodeCount, beforeCount + 1)
  // 事务应已完成
  assertEquals(mgr.isValid(tid), false)
})

// ─── find_node 响应 ───────────────────────────────────────────────────────────

Deno.test('ResponseHandler - find_node 响应解析 nodes 并加入路由表', async () => {
  const handler = new ResponseHandler()
  const tid = mgr.create({ type: QueryType.FIND_NODE, addr: REMOTE_ADDR, port: REMOTE_PORT })

  // 构造 2 个紧凑节点（各 26 字节）
  const n1 = makeNode('resp-fn-node-1', '11.11.11.11', 1111)
  const n2 = makeNode('resp-fn-node-2', '12.12.12.12', 2222)
  const nodesBytes = new Uint8Array([...n1.toCompact(), ...n2.toCompact()])

  const beforeCount = RoutingTable.get().nodeCount

  const sender = new MockSender()
  await handler.handle(
    { t: tid, y: MessageType.RESPONSE, r: { id: RESP_NODE_ID, nodes: nodesBytes, token: 'gp-token' } },
    REMOTE_ADDR,
    REMOTE_PORT,
    sender,
  )
  // 解析出 2 个节点 + 响应节点本身，路由表至少增加 1 个（部分节点可能已存在）
  assertEquals(RoutingTable.get().nodeCount > beforeCount, true)
})

Deno.test('ResponseHandler - find_node 响应 nodes 字节不是 26 的倍数时静默丢弃', async () => {
  const handler = new ResponseHandler()
  const tid = mgr.create({ type: QueryType.FIND_NODE, addr: REMOTE_ADDR, port: REMOTE_PORT })
  const beforeCount = RoutingTable.get().nodeCount

  const sender = new MockSender()
  await handler.handle(
    { t: tid, y: MessageType.RESPONSE, r: { id: RESP_NODE_ID, nodes: new Uint8Array(20) } },
    REMOTE_ADDR,
    REMOTE_PORT,
    sender,
  )
  // 节点数不应增加（响应节点本身由于丢弃逻辑不被添加）
  assertEquals(RoutingTable.get().nodeCount, beforeCount)
})

Deno.test('ResponseHandler - find_node 响应缺少 nodes 字段时静默丢弃', async () => {
  const handler = new ResponseHandler()
  const tid = mgr.create({ type: QueryType.FIND_NODE, addr: REMOTE_ADDR, port: REMOTE_PORT })
  const beforeCount = RoutingTable.get().nodeCount

  const sender = new MockSender()
  await handler.handle(
    { t: tid, y: MessageType.RESPONSE, r: { id: RESP_NODE_ID } },
    REMOTE_ADDR,
    REMOTE_PORT,
    sender,
  )
  assertEquals(RoutingTable.get().nodeCount, beforeCount)
})

// ─── get_peers 响应（含 values）────────────────────────────────────────────────

Deno.test('ResponseHandler - get_peers 响应含 values 时将 peers 存入 InfoHashManager', async () => {
  const handler = new ResponseHandler()
  const infoHash = makeInfoHash('gp-values-file')
  const infoHashHex = encodeHex(infoHash)
  const tid = mgr.create({ type: QueryType.GET_PEERS, addr: REMOTE_ADDR, port: REMOTE_PORT, infoHash })

  // 构造一个紧凑 peer 地址（6 字节）
  const peerCompact = new Uint8Array([20, 20, 20, 20, 0x1b, 0xe5]) // 20.20.20.20:7141

  const sender = new MockSender()
  await handler.handle(
    { t: tid, y: MessageType.RESPONSE, r: { id: RESP_NODE_ID, values: [peerCompact], token: 'gp-token' } },
    REMOTE_ADDR,
    REMOTE_PORT,
    sender,
  )
  const peers = InfoHashManager.get().find(infoHashHex)
  assertEquals(peers !== undefined && peers.length > 0, true)
})

// ─── get_peers 响应（含 nodes）────────────────────────────────────────────────

Deno.test('ResponseHandler - get_peers 响应含 nodes 时发起二轮 get_peers 请求', async () => {
  const handler = new ResponseHandler()
  const infoHash = makeInfoHash('gp-nodes-file')
  const tid = mgr.create({ type: QueryType.GET_PEERS, addr: REMOTE_ADDR, port: REMOTE_PORT, infoHash })

  const node = makeNode('gp-relay-node', '13.13.13.13', 3333)
  const nodesBytes = node.toCompact() // 26 字节

  const sender = new MockSender()
  await handler.handle(
    { t: tid, y: MessageType.RESPONSE, r: { id: RESP_NODE_ID, nodes: nodesBytes, token: 'gp-token' } },
    REMOTE_ADDR,
    REMOTE_PORT,
    sender,
  )
  // 应向 nodes 中的每个节点发出 get_peers 请求
  assertEquals(sender.sentGetPeers.length, 1)
  assertEquals(sender.sentGetPeers[0]?.infoHash, infoHash)
})

Deno.test('ResponseHandler - get_peers 响应缺少 token 时静默丢弃', async () => {
  const handler = new ResponseHandler()
  const infoHash = makeInfoHash('gp-no-token')
  // 合法 TID，但 r 中不携带 token
  const tid = mgr.create({ type: QueryType.GET_PEERS, addr: REMOTE_ADDR, port: REMOTE_PORT, infoHash })
  const sender = new MockSender()
  await handler.handle(
    { t: tid, y: MessageType.RESPONSE, r: { id: RESP_NODE_ID, values: [] } },
    REMOTE_ADDR,
    REMOTE_PORT,
    sender,
  )
  // r.token 缺失，消息被丢弃，不会发出任何请求
  assertEquals(sender.sentGetPeers.length, 0)
  assertEquals(sender.sentMessages.length, 0)
})

// ─── announce_peer 响应 ───────────────────────────────────────────────────────

Deno.test('ResponseHandler - announce_peer 响应将节点加入路由表', async () => {
  const handler = new ResponseHandler()
  // 使用独立 ID，避免与 ping 测试添加的节点重复
  const uniqueId = makeInfoHash('ap-unique-resp-node')
  const tid = mgr.create({ type: QueryType.ANNOUNCE_PEER, addr: '7.7.7.7', port: 7001 })
  const beforeCount = RoutingTable.get().nodeCount

  const sender = new MockSender()
  await handler.handle(
    { t: tid, y: MessageType.RESPONSE, r: { id: uniqueId } },
    '7.7.7.7',
    7001,
    sender,
  )
  assertEquals(RoutingTable.get().nodeCount, beforeCount + 1)
  assertEquals(mgr.isValid(tid), false)
})

// ─── getHandleMessageType ─────────────────────────────────────────────────────

Deno.test('ResponseHandler.getHandleMessageType - 返回 RESPONSE 类型', () => {
  assertEquals(new ResponseHandler().getHandleMessageType(), MessageType.RESPONSE)
})

// ─── get_peers 无效 peer 字节 ─────────────────────────────────────────────────

Deno.test('ResponseHandler - get_peers values 含非 6 字节元素时静默丢弃', async () => {
  const handler = new ResponseHandler()
  const infoHash = makeInfoHash('gp-bad-peer-bytes')
  const infoHashHex = encodeHex(infoHash)
  const tid = mgr.create({ type: QueryType.GET_PEERS, addr: REMOTE_ADDR, port: REMOTE_PORT, infoHash })

  // 5 字节 peer，长度无效
  const sender = new MockSender()
  await handler.handle(
    { t: tid, y: MessageType.RESPONSE, r: { id: RESP_NODE_ID, values: [new Uint8Array(5)], token: 'bad-token' } },
    REMOTE_ADDR,
    REMOTE_PORT,
    sender,
  )
  // 无效 peer 数据：InfoHashManager 不应记录任何 peer
  assertEquals(InfoHashManager.get().find(infoHashHex), undefined)
})

// ─── get_peers 空 values 数组 ────────────────────────────────────────────────

Deno.test('ResponseHandler - get_peers 空 values 且有 token 时不存储任何 peer', async () => {
  const handler = new ResponseHandler()
  const infoHash = makeInfoHash('gp-empty-values')
  const infoHashHex = encodeHex(infoHash)
  const tid = mgr.create({ type: QueryType.GET_PEERS, addr: REMOTE_ADDR, port: REMOTE_PORT, infoHash })

  const sender = new MockSender()
  await handler.handle(
    { t: tid, y: MessageType.RESPONSE, r: { id: RESP_NODE_ID, values: [], token: 'some-token' } },
    REMOTE_ADDR,
    REMOTE_PORT,
    sender,
  )
  // 空 values 列表：没有 peer 可存
  assertEquals(InfoHashManager.get().find(infoHashHex), undefined)
})
