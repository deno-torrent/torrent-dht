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
import { sha1 } from '../src/util/hash.ts'

const tokenBytes = (value: string): Uint8Array => new TextEncoder().encode(value)

const localId = Id.fromUnit8Array(sha1(new TextEncoder().encode('message-factory-test')))

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
  const token = tokenBytes('tok123')
  const mf = MessageFactory.requestAnnouncePeer('dd', nodeId, infoHash, 7777, token)
  const msg = mf.message()
  assertEquals(msg.y, MessageType.QUERY)
  assertEquals(msg.q, QueryType.ANNOUNCE_PEER)
  assertEquals(msg.a?.implied_port, 0)
  assertEquals(msg.a?.port, 7777)
  assertEquals(msg.a?.info_hash, infoHash)
  assertEquals(msg.a?.token, token)
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
  const msg = MessageFactory.responsePing('gg', localId).message()
  assertEquals(msg.y, MessageType.RESPONSE)
  assertEquals(msg.r?.id, localId.bits.bytes)
})

// ─── responseFindNode ────────────────────────────────────────────────────────

Deno.test('MessageFactory.responseFindNode - nodes 长度等于节点数 × 26', () => {
  const id1 = Id.fromUnit8Array(sha1(new TextEncoder().encode('n1')))
  const id2 = Id.fromUnit8Array(sha1(new TextEncoder().encode('n2')))
  const nodes = [new Node(id1, 1111, '1.1.1.1'), new Node(id2, 2222, '2.2.2.2')]
  const msg = MessageFactory.responseFindNode('hh', localId, nodes).message()
  assertEquals(msg.y, MessageType.RESPONSE)
  assertEquals(msg.r?.nodes?.length, 52) // 2 × 26
})

// ─── responseGetPeers ────────────────────────────────────────────────────────

Deno.test('MessageFactory.responseGetPeers - 有 peers 时返回 values 字段', () => {
  const peer = new Peer(9999, '9.9.9.9')
  const msg = MessageFactory.responseGetPeers('ii', localId, [peer]).message()
  assertEquals(msg.y, MessageType.RESPONSE)
  assertEquals(Array.isArray(msg.r?.values), true)
  assertEquals(msg.r?.values?.length, 1)
})

Deno.test('MessageFactory.responseGetPeers - 有 nodes 时返回 nodes 字段', () => {
  const n = new Node(Id.random(), 1234, '1.2.3.4')
  const token = tokenBytes('announce-token')
  const msg = MessageFactory.responseGetPeers('jj', localId, undefined, [n], token).message()
  assertEquals(msg.r?.nodes instanceof Uint8Array, true)
  assertEquals(msg.r?.token, token)
})

Deno.test('MessageFactory - opaque binary token survives bencode round trip', async () => {
  const token = new Uint8Array([0, 255, 128, 1])
  const encoded = await MessageFactory.requestAnnouncePeer(
    'tk',
    Id.random(),
    new Uint8Array(20),
    6881,
    token,
  ).bencode()

  assertEquals((await MessageFactory.decode(encoded))?.a?.token, token)
})

Deno.test('MessageFactory.responseGetPeers - peers/nodes 均为空时抛出异常', () => {
  let threw = false
  try {
    MessageFactory.responseGetPeers('kk', localId)
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
  assertEquals(decoded?.a?.id, nodeId.bits.bytes)
})

Deno.test('MessageFactory.decode - 将有效 UTF-8 的二进制协议字段恢复为 Uint8Array', async () => {
  const asciiBytes = new Uint8Array(20).fill(0x61)
  const asciiId = Id.fromUnit8Array(asciiBytes)
  const ping = await MessageFactory.decode(await MessageFactory.requestPing('ab', asciiId).bencode())
  const getPeers = await MessageFactory.decode(
    await MessageFactory.requestGetPeers('ac', nodeId, asciiBytes).bencode(),
  )

  assertEquals(ping?.a?.id instanceof Uint8Array, true)
  assertEquals(ping?.a?.id, asciiBytes)
  assertEquals(getPeers?.a?.info_hash instanceof Uint8Array, true)
  assertEquals(getPeers?.a?.info_hash, asciiBytes)
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

Deno.test('MessageFactory.decode - 拒绝缺少类型对应容器的消息', async () => {
  const encoder = new TextEncoder()
  assertEquals(await MessageFactory.decode(encoder.encode('d1:t2:aa1:y1:qe')), undefined)
  assertEquals(await MessageFactory.decode(encoder.encode('d1:t2:aa1:y1:re')), undefined)
  assertEquals(await MessageFactory.decode(encoder.encode('d1:t2:aa1:y1:ee')), undefined)
})

Deno.test('MessageFactory.decode - 拒绝未知消息类型', async () => {
  assertEquals(await MessageFactory.decode(new TextEncoder().encode('d1:t2:aa1:y1:xe')), undefined)
})

Deno.test('MessageFactory.decode - bencode 2.0 拒绝尾随数据', async () => {
  const encoded = await MessageFactory.requestPing('aa', nodeId).bencode()
  const withTrailingByte = new Uint8Array(encoded.length + 1)
  withTrailingByte.set(encoded)
  withTrailingByte[encoded.length] = 0

  assertEquals(await MessageFactory.decode(withTrailingByte), undefined)
})

Deno.test('MessageFactory.decode - 接受 libtorrent 风格的未排序 KRPC 字典', async () => {
  // Top-level keys are ip, r, t, y, v. Canonical byte order would place v before y.
  const encoded = new TextEncoder().encode(
    'd2:ip6:abcdef1:rd2:id20:abcdefghijklmnopqrste1:t2:aa1:y1:r1:v4:LT01e',
  )

  const decoded = await MessageFactory.decode(encoded)

  assertEquals(decoded?.t, 'aa')
  assertEquals(decoded?.y, MessageType.RESPONSE)
  assertEquals(decoded?.r?.id, new TextEncoder().encode('abcdefghijklmnopqrst'))
})

Deno.test('MessageFactory - arbitrary binary transaction IDs round trip without loss', async () => {
  const binaryTid = new Uint8Array([0xe4, 0xa8, 0x29, 0x14, 0x8f, 0xde, 0xeb, 0x31])
  const encoded = await MessageFactory.requestFindNode(binaryTid, nodeId, Id.random()).bencode()
  const decoded = await MessageFactory.decode(encoded)

  assertEquals(decoded?.t, binaryTid)

  const response = await MessageFactory.responsePing(decoded!.t, localId).bencode()
  assertEquals((await MessageFactory.decode(response))?.t, binaryTid)
})

Deno.test('MessageFactory.decode - 拒绝超过 KRPC UDP 上限的数据', async () => {
  assertEquals(await MessageFactory.decode(new Uint8Array(65_508)), undefined)
})

Deno.test('MessageFactory.decode - 拒绝超过 KRPC 嵌套上限的数据', async () => {
  const deeplyNestedList = new TextEncoder().encode(`${'l'.repeat(17)}${'e'.repeat(17)}`)
  assertEquals(await MessageFactory.decode(deeplyNestedList), undefined)
})

// ─── responseAnnouncePeer ────────────────────────────────────────────────────

Deno.test('MessageFactory.responseAnnouncePeer - 返回正确类型的响应消息', () => {
  const msg = MessageFactory.responseAnnouncePeer('mm', localId).message()
  assertEquals(msg.y, MessageType.RESPONSE)
  assertEquals(msg.t, 'mm')
  // announce_peer 响应只包含本地节点 ID
  assertEquals(msg.r?.id, localId.bits.bytes)
})

Deno.test('MessageFactory bencode/decode - announce_peer 响应往返', async () => {
  const encoded = await MessageFactory.responseAnnouncePeer('nn', localId).bencode()
  const decoded = await MessageFactory.decode(encoded)
  assertEquals(decoded?.y, MessageType.RESPONSE)
  assertEquals(decoded?.t, 'nn')
})
