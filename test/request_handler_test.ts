/**
 * RequestHandler 测试
 *
 * RequestHandler 处理来自其他节点的 KRPC 查询（ping / find_node / get_peers / announce_peer）。
 * 使用 MockSender 捕获所有出站消息，不产生任何真实网络 I/O。
 */
import { assertEquals } from '@std/assert'
import { encodeHex } from '@std/encoding/hex'
import RequestHandler from '../src/krpc/handler/request_handler.ts'
import { ErrorType, MessageType, QueryType } from '../src/message_factory.ts'
import RoutingTable from '../src/routing_table.ts'
import InfoHashManager from '../src/info_hash_manager.ts'
import Peer from '../src/peer.ts'
import { makeInfoHash, makeLocalNode, makeNode, MockSender } from './fixtures.ts'

// 每个测试文件运行在独立的 Deno worker 中，单例从零开始
const localNode = makeLocalNode('request-handler-test')
RoutingTable.init(localNode)

// 模拟发起查询的远端节点信息
const REMOTE_ADDR = '2.2.2.2'
const REMOTE_PORT = 7777
// 合法的 20 字节 node ID（代表远端查询节点）
const REMOTE_ID = makeInfoHash('remote-node')

// ─── 无效 node ID ─────────────────────────────────────────────────────────────

Deno.test('RequestHandler - node ID 字节长度不是 20 时返回 PROTOCOL 错误', async () => {
  const handler = new RequestHandler()
  const sender = new MockSender()
  await handler.handle(
    { t: 'aa', y: MessageType.QUERY, q: QueryType.PING, a: { id: new Uint8Array(10) } },
    REMOTE_ADDR,
    REMOTE_PORT,
    sender,
  )
  const msg = sender.getMessageAt(0)
  assertEquals(msg?.y, MessageType.ERROR)
  assertEquals(msg?.e?.[0], ErrorType.PROTOCOL)
})

Deno.test('RequestHandler - node ID 缺失时返回 PROTOCOL 错误', async () => {
  const handler = new RequestHandler()
  const sender = new MockSender()
  await handler.handle(
    { t: 'aa', y: MessageType.QUERY, q: QueryType.PING, a: { id: undefined as unknown as Uint8Array } },
    REMOTE_ADDR,
    REMOTE_PORT,
    sender,
  )
  const msg = sender.getMessageAt(0)
  assertEquals(msg?.y, MessageType.ERROR)
  assertEquals(msg?.e?.[0], ErrorType.PROTOCOL)
})

// ─── ping ─────────────────────────────────────────────────────────────────────

Deno.test('RequestHandler - ping 请求返回 RESPONSE 并携带正确 TID', async () => {
  const handler = new RequestHandler()
  const sender = new MockSender()
  await handler.handle(
    { t: 'bb', y: MessageType.QUERY, q: QueryType.PING, a: { id: REMOTE_ID } },
    REMOTE_ADDR,
    REMOTE_PORT,
    sender,
  )
  const msg = sender.getMessageAt(0)
  assertEquals(msg?.y, MessageType.RESPONSE)
  assertEquals(msg?.t, 'bb')
})

Deno.test('RequestHandler - ping 响应发送至请求方地址', async () => {
  const handler = new RequestHandler()
  const sender = new MockSender()
  await handler.handle(
    { t: 'bc', y: MessageType.QUERY, q: QueryType.PING, a: { id: REMOTE_ID } },
    REMOTE_ADDR,
    REMOTE_PORT,
    sender,
  )
  assertEquals(sender.sentMessages[0]?.addr, REMOTE_ADDR)
  assertEquals(sender.sentMessages[0]?.port, REMOTE_PORT)
})

// ─── find_node ────────────────────────────────────────────────────────────────

Deno.test('RequestHandler - find_node 缺少 target 字段时返回 PROTOCOL 错误', async () => {
  const handler = new RequestHandler()
  const sender = new MockSender()
  await handler.handle(
    { t: 'cc', y: MessageType.QUERY, q: QueryType.FIND_NODE, a: { id: REMOTE_ID } },
    REMOTE_ADDR,
    REMOTE_PORT,
    sender,
  )
  assertEquals(sender.getMessageAt(0)?.e?.[0], ErrorType.PROTOCOL)
})

Deno.test('RequestHandler - find_node target 长度非 20 时返回 PROTOCOL 错误', async () => {
  const handler = new RequestHandler()
  const sender = new MockSender()
  await handler.handle(
    { t: 'cd', y: MessageType.QUERY, q: QueryType.FIND_NODE, a: { id: REMOTE_ID, target: new Uint8Array(5) } },
    REMOTE_ADDR,
    REMOTE_PORT,
    sender,
  )
  assertEquals(sender.getMessageAt(0)?.e?.[0], ErrorType.PROTOCOL)
})

Deno.test('RequestHandler - find_node 路由表为空时返回 GENERIC 错误', async () => {
  // 此时路由表只有 localNode，findClosestNodes 对随机 target 可能返回空
  // 先确保路由表中没有其他节点
  RoutingTable.get().getAllNodes().forEach((n) => RoutingTable.get().remove(n))

  const handler = new RequestHandler()
  const sender = new MockSender()
  await handler.handle(
    {
      t: 'ce',
      y: MessageType.QUERY,
      q: QueryType.FIND_NODE,
      a: { id: REMOTE_ID, target: makeInfoHash('nonexistent-target') },
    },
    REMOTE_ADDR,
    REMOTE_PORT,
    sender,
  )
  assertEquals(sender.getMessageAt(0)?.e?.[0], ErrorType.GENERIC)
})

Deno.test('RequestHandler - find_node 有最近节点时返回 RESPONSE', async () => {
  // 添加节点到路由表，确保 findClosestNodes 返回非空
  RoutingTable.get().add(makeNode('fn-node-1', '3.3.3.3', 1111))
  RoutingTable.get().add(makeNode('fn-node-2', '4.4.4.4', 2222))

  const handler = new RequestHandler()
  const sender = new MockSender()
  await handler.handle(
    {
      t: 'cf',
      y: MessageType.QUERY,
      q: QueryType.FIND_NODE,
      a: { id: REMOTE_ID, target: makeInfoHash('fn-target') },
    },
    REMOTE_ADDR,
    REMOTE_PORT,
    sender,
  )
  assertEquals(sender.getMessageAt(0)?.y, MessageType.RESPONSE)
})

// ─── get_peers ────────────────────────────────────────────────────────────────

Deno.test('RequestHandler - get_peers 有已知 peers 时返回含 values 的 RESPONSE', async () => {
  const infoHash = makeInfoHash('known-file')
  const infoHashHex = encodeHex(infoHash)
  // 预置 peer 和 token
  InfoHashManager.get().add(infoHashHex, new Peer(9999, '9.9.9.9'), 'test-token')

  const handler = new RequestHandler()
  const sender = new MockSender()
  await handler.handle(
    { t: 'dd', y: MessageType.QUERY, q: QueryType.GET_PEERS, a: { id: REMOTE_ID, info_hash: infoHash } },
    REMOTE_ADDR,
    REMOTE_PORT,
    sender,
  )
  const msg = sender.getMessageAt(0)
  assertEquals(msg?.y, MessageType.RESPONSE)
  assertEquals(Array.isArray(msg?.r?.values), true)
})

Deno.test('RequestHandler - get_peers 无 peers 但有最近节点时返回含 nodes 的 RESPONSE', async () => {
  const infoHash = makeInfoHash('unknown-file')

  const handler = new RequestHandler()
  const sender = new MockSender()
  await handler.handle(
    { t: 'de', y: MessageType.QUERY, q: QueryType.GET_PEERS, a: { id: REMOTE_ID, info_hash: infoHash } },
    REMOTE_ADDR,
    REMOTE_PORT,
    sender,
  )
  const msg = sender.getMessageAt(0)
  // 路由表中有节点（上一个测试添加的），所以应返回 RESPONSE（带 nodes）
  assertEquals(msg?.y, MessageType.RESPONSE)
})

Deno.test('RequestHandler - get_peers 无 peers 且路由表为空时返回 GENERIC 错误', async () => {
  // 清空路由表
  RoutingTable.get().getAllNodes().forEach((n) => RoutingTable.get().remove(n))

  const infoHash = makeInfoHash('no-peers-no-nodes')

  const handler = new RequestHandler()
  const sender = new MockSender()
  await handler.handle(
    { t: 'df', y: MessageType.QUERY, q: QueryType.GET_PEERS, a: { id: REMOTE_ID, info_hash: infoHash } },
    REMOTE_ADDR,
    REMOTE_PORT,
    sender,
  )
  assertEquals(sender.getMessageAt(0)?.e?.[0], ErrorType.GENERIC)
})

// ─── announce_peer ────────────────────────────────────────────────────────────

Deno.test('RequestHandler - announce_peer infoHash 无效时返回 PROTOCOL 错误', async () => {
  const handler = new RequestHandler()
  const sender = new MockSender()
  await handler.handle(
    {
      t: 'ee',
      y: MessageType.QUERY,
      q: QueryType.ANNOUNCE_PEER,
      a: { id: REMOTE_ID, info_hash: new Uint8Array(5), port: 6881 },
    },
    REMOTE_ADDR,
    REMOTE_PORT,
    sender,
  )
  assertEquals(sender.getMessageAt(0)?.e?.[0], ErrorType.PROTOCOL)
})

Deno.test('RequestHandler - announce_peer 缺少 port 时返回 PROTOCOL 错误', async () => {
  const handler = new RequestHandler()
  const sender = new MockSender()
  await handler.handle(
    {
      t: 'ef',
      y: MessageType.QUERY,
      q: QueryType.ANNOUNCE_PEER,
      a: { id: REMOTE_ID, info_hash: makeInfoHash('no-port-file'), port: 0 },
    },
    REMOTE_ADDR,
    REMOTE_PORT,
    sender,
  )
  assertEquals(sender.getMessageAt(0)?.e?.[0], ErrorType.PROTOCOL)
})

Deno.test('RequestHandler - announce_peer 合法请求返回 RESPONSE 并存储 Peer', async () => {
  const infoHash = makeInfoHash('announce-file')
  const infoHashHex = encodeHex(infoHash)

  const handler = new RequestHandler()
  const sender = new MockSender()
  await handler.handle(
    {
      t: 'eg',
      y: MessageType.QUERY,
      q: QueryType.ANNOUNCE_PEER,
      a: { id: REMOTE_ID, info_hash: infoHash, port: 51413, implied_port: 0, token: 'valid-token' },
    },
    REMOTE_ADDR,
    REMOTE_PORT,
    sender,
  )
  assertEquals(sender.getMessageAt(0)?.y, MessageType.RESPONSE)

  // peer 应已被存储到 InfoHashManager
  const peers = InfoHashManager.get().find(infoHashHex)
  assertEquals(peers !== undefined && peers.length > 0, true)
})

Deno.test('RequestHandler - announce_peer implied_port=1 时使用发送方端口', async () => {
  const infoHash = makeInfoHash('announce-implied-port')
  const infoHashHex = encodeHex(infoHash)

  const handler = new RequestHandler()
  const sender = new MockSender()
  await handler.handle(
    {
      t: 'eh',
      y: MessageType.QUERY,
      q: QueryType.ANNOUNCE_PEER,
      a: { id: REMOTE_ID, info_hash: infoHash, port: 99999, implied_port: 1, token: 'valid-token' },
    },
    REMOTE_ADDR,
    REMOTE_PORT,
    sender,
  )
  assertEquals(sender.getMessageAt(0)?.y, MessageType.RESPONSE)

  // implied_port=1：应使用发送方端口（REMOTE_PORT）而非 a.port
  const peers = InfoHashManager.get().find(infoHashHex)
  assertEquals(peers?.[0]?.port, REMOTE_PORT)
})

// ─── getHandleMessageType ─────────────────────────────────────────────────────

Deno.test('RequestHandler.getHandleMessageType - 返回 QUERY 类型', () => {
  assertEquals(new RequestHandler().getHandleMessageType(), MessageType.QUERY)
})

// ─── announce_peer 缺少 token ─────────────────────────────────────────────────

Deno.test('RequestHandler - announce_peer 缺少 token 时返回 PROTOCOL 错误', async () => {
  const handler = new RequestHandler()
  const sender = new MockSender()
  await handler.handle(
    {
      t: 'ei',
      y: MessageType.QUERY,
      q: QueryType.ANNOUNCE_PEER,
      // token 为空字符串，等同于缺失（falsy）
      a: { id: REMOTE_ID, info_hash: makeInfoHash('no-token-announce'), port: 6881, token: '' },
    },
    REMOTE_ADDR,
    REMOTE_PORT,
    sender,
  )
  assertEquals(sender.getMessageAt(0)?.e?.[0], ErrorType.PROTOCOL)
})

// ─── announce_peer token 不匹配 ───────────────────────────────────────────────

Deno.test('RequestHandler - announce_peer token 与已记录不匹配时返回 PROTOCOL 错误', async () => {
  const infoHash = makeInfoHash('mismatch-token-file')
  const infoHashHex = encodeHex(infoHash)
  // 预先为该 infohash 注册 token-a
  InfoHashManager.get().add(infoHashHex, new Peer(8001, '8.0.0.1'), 'token-a')

  const handler = new RequestHandler()
  const sender = new MockSender()
  await handler.handle(
    {
      t: 'ej',
      y: MessageType.QUERY,
      q: QueryType.ANNOUNCE_PEER,
      a: { id: REMOTE_ID, info_hash: infoHash, port: 6882, token: 'token-b' }, // token 不匹配
    },
    REMOTE_ADDR,
    REMOTE_PORT,
    sender,
  )
  assertEquals(sender.getMessageAt(0)?.e?.[0], ErrorType.PROTOCOL)
})

// ─── 未知查询类型 ─────────────────────────────────────────────────────────────

Deno.test('RequestHandler - 未知查询类型不发送任何消息', async () => {
  const handler = new RequestHandler()
  const sender = new MockSender()
  await handler.handle(
    // deno-lint-ignore no-explicit-any
    { t: 'ek', y: MessageType.QUERY, q: 'unknown_type' as any, a: { id: REMOTE_ID } },
    REMOTE_ADDR,
    REMOTE_PORT,
    sender,
  )
  // 未知类型：仅记录日志，不发出任何回复
  assertEquals(sender.sentMessages.length, 0)
})
