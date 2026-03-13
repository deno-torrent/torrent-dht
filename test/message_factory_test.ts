/**
 * MessageFactory 测试
 * - 各查询 / 响应 / 错误消息的结构
 * - bencode / decode 往返序列化
 */
import { assertEquals } from '@std/assert'
import MessageFactory, { ErrorType, MessageType, QueryType } from '../src/message_factory.ts'
import Id from '../src/id.ts'
import Node from '../src/node.ts'
import Peer from '../src/peer.ts'
import LocalNode from '../src/local_node.ts'
import RoutingTable from '../src/routing_table.ts'
import { sha1 } from '../src/util/hash.ts'

// response* 方法需要访问 RoutingTable.get().localNode，提前初始化单例
const localId = Id.fromUnit8Array(sha1(new TextEncoder().encode('message-factory-test')))
const localNode = new LocalNode(localId, 16888, '127.0.0.1')
RoutingTable.init(localNode)

const nodeId = Id.random()

// ─── requestPing ────────────────────────────────────────────────────────────

Deno.test('MessageFactory.requestPing - 消息结构正确', () => {
  const mf = MessageFactory.requestPing('aa', nodeId)
  const msg = mf.message()
  assertEquals(msg.t, 'aa')
  assertEquals(msg.y, MessageType.QUERY)
  assertEquals(msg.q, QueryType.PING)
  assertEquals(msg.a?.id, nodeId.bits.bytes)
})

// ─── requestFindNode ─────────────────────────────────────────────────────────

Deno.test('MessageFactory.requestFindNode - 消息结构正确', () => {
  const targetId = Id.random()
  const mf = MessageFactory.requestFindNode('bb', nodeId, targetId)
  const msg = mf.message()
  assertEquals(msg.y, MessageType.QUERY)
  assertEquals(msg.q, QueryType.FIND_NODE)
  assertEquals(msg.a?.id, nodeId.bits.bytes)
  assertEquals(msg.a?.target, targetId.bits.bytes)
})

// ─── requestGetPeers ─────────────────────────────────────────────────────────

Deno.test('MessageFactory.requestGetPeers - 消息结构正确', () => {
  const infoHash = sha1(new TextEncoder().encode('test-infohash'))
  const mf = MessageFactory.requestGetPeers('cc', nodeId, infoHash)
  const msg = mf.message()
  assertEquals(msg.y, MessageType.QUERY)
  assertEquals(msg.q, QueryType.GET_PEERS)
  assertEquals(msg.a?.info_hash, infoHash)
})

// ─── requestAnnouncePeer ─────────────────────────────────────────────────────

Deno.test('MessageFactory.requestAnnouncePeer - 消息结构正确', () => {
  const infoHash = sha1(new TextEncoder().encode('announce-test'))
  const mf = MessageFactory.requestAnnouncePeer('dd', nodeId, infoHash, 7777, 'tok123')
  const msg = mf.message()
  assertEquals(msg.y, MessageType.QUERY)
  assertEquals(msg.q, QueryType.ANNOUNCE_PEER)
  assertEquals(msg.a?.implied_port, 0)
  assertEquals(msg.a?.port, 7777)
  assertEquals(msg.a?.info_hash, infoHash)
  assertEquals(msg.a?.token, 'tok123')
})

// ─── responseError ───────────────────────────────────────────────────────────

Deno.test('MessageFactory.responseError - 错误码与描述正确', () => {
  const mf = MessageFactory.responseError('ee', ErrorType.PROTOCOL, 'bad token')
  const msg = mf.message()
  assertEquals(msg.y, MessageType.ERROR)
  assertEquals(msg.e?.[0], ErrorType.PROTOCOL)
  assertEquals(msg.e?.[1], 'bad token')
})

Deno.test('MessageFactory.responseError - 无描述时 e[1] 为空字符串', () => {
  const msg = MessageFactory.responseError('ff', ErrorType.GENERIC).message()
  assertEquals(msg.e?.[1], '')
})

// ─── responsePing ────────────────────────────────────────────────────────────

Deno.test('MessageFactory.responsePing - 包含本地节点 ID', () => {
  const msg = MessageFactory.responsePing('gg').message()
  assertEquals(msg.y, MessageType.RESPONSE)
  assertEquals(msg.r?.id, localNode.id.bits.bytes)
})

// ─── responseFindNode ────────────────────────────────────────────────────────

Deno.test('MessageFactory.responseFindNode - nodes 长度等于节点数 × 26', () => {
  const id1 = Id.fromUnit8Array(sha1(new TextEncoder().encode('n1')))
  const id2 = Id.fromUnit8Array(sha1(new TextEncoder().encode('n2')))
  const nodes = [new Node(id1, 1111, '1.1.1.1'), new Node(id2, 2222, '2.2.2.2')]
  const msg = MessageFactory.responseFindNode('hh', nodes).message()
  assertEquals(msg.y, MessageType.RESPONSE)
  assertEquals(msg.r?.nodes?.length, 52) // 2 × 26
})

// ─── responseGetPeers ────────────────────────────────────────────────────────

Deno.test('MessageFactory.responseGetPeers - 有 peers 时返回 values 字段', () => {
  const peer = new Peer(9999, '9.9.9.9')
  const msg = MessageFactory.responseGetPeers('ii', [peer]).message()
  assertEquals(msg.y, MessageType.RESPONSE)
  assertEquals(Array.isArray(msg.r?.values), true)
  assertEquals(msg.r?.values?.length, 1)
})

Deno.test('MessageFactory.responseGetPeers - 有 nodes 时返回 nodes 字段', () => {
  const n = new Node(Id.random(), 1234, '1.2.3.4')
  const msg = MessageFactory.responseGetPeers('jj', undefined, [n]).message()
  assertEquals(msg.r?.nodes instanceof Uint8Array, true)
})

Deno.test('MessageFactory.responseGetPeers - peers/nodes 均为空时抛出异常', () => {
  let threw = false
  try {
    MessageFactory.responseGetPeers('kk')
  } catch {
    threw = true
  }
  assertEquals(threw, true)
})

// ─── bencode / decode 往返序列化 ─────────────────────────────────────────────

Deno.test('MessageFactory bencode/decode - ping 请求往返', async () => {
  const original = MessageFactory.requestPing('aa', nodeId)
  const encoded = await original.bencode()
  const decoded = await MessageFactory.decode(encoded)
  assertEquals(decoded?.t, 'aa')
  assertEquals(decoded?.y, MessageType.QUERY)
  assertEquals(decoded?.q, QueryType.PING)
})

Deno.test('MessageFactory bencode/decode - find_node 请求往返', async () => {
  const targetId = Id.random()
  const encoded = await MessageFactory.requestFindNode('bb', nodeId, targetId).bencode()
  const decoded = await MessageFactory.decode(encoded)
  assertEquals(decoded?.q, QueryType.FIND_NODE)
  assertEquals(decoded?.t, 'bb')
})

Deno.test('MessageFactory bencode/decode - error 消息往返', async () => {
  const encoded = await MessageFactory.responseError('ll', ErrorType.SERVER, 'oops').bencode()
  const decoded = await MessageFactory.decode(encoded)
  assertEquals(decoded?.y, MessageType.ERROR)
  assertEquals(decoded?.e?.[0], ErrorType.SERVER)
})

Deno.test('MessageFactory.decode - 随机字节返回 undefined', async () => {
  const result = await MessageFactory.decode(new Uint8Array([0x00, 0x01, 0x02]))
  assertEquals(result, undefined)
})

Deno.test('MessageFactory.decode - 空数据返回 undefined', async () => {
  const result = await MessageFactory.decode(new Uint8Array(0))
  assertEquals(result, undefined)
})

// ─── responseAnnouncePeer ────────────────────────────────────────────────────

Deno.test('MessageFactory.responseAnnouncePeer - 返回正确类型的响应消息', () => {
  const msg = MessageFactory.responseAnnouncePeer('mm').message()
  assertEquals(msg.y, MessageType.RESPONSE)
  assertEquals(msg.t, 'mm')
  // announce_peer 响应只包含本地节点 ID
  assertEquals(msg.r?.id, localNode.id.bits.bytes)
})

Deno.test('MessageFactory bencode/decode - announce_peer 响应往返', async () => {
  const encoded = await MessageFactory.responseAnnouncePeer('nn').bencode()
  const decoded = await MessageFactory.decode(encoded)
  assertEquals(decoded?.y, MessageType.RESPONSE)
  assertEquals(decoded?.t, 'nn')
})
