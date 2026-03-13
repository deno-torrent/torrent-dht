/**
 * ErrorHandler 测试
 *
 * ErrorHandler 处理来自其他节点的 KRPC 错误响应。
 * 合法事务应被完成（finish），无效 TID 的错误消息应被静默忽略。
 */
import { assertEquals } from '@std/assert'
import ErrorHandler from '../src/krpc/handler/error_handler.ts'
import TransactionManager from '../src/krpc/transaction_manager.ts'
import { MessageType, QueryType } from '../src/message_factory.ts'
import { MockSender } from './fixtures.ts'

const handler = new ErrorHandler()
const mgr = TransactionManager.get()

const REMOTE_ADDR = '6.6.6.6'
const REMOTE_PORT = 9999

// ─── 无效 TID ─────────────────────────────────────────────────────────────────

Deno.test('ErrorHandler - TID 不存在时静默忽略', async () => {
  const sender = new MockSender()
  await handler.handle(
    { t: 'ZZ', y: MessageType.ERROR, e: [203, 'invalid token'] },
    REMOTE_ADDR,
    REMOTE_PORT,
    sender,
  )
  // 不应有任何出站消息，不应抛出
  assertEquals(sender.sentMessages.length, 0)
})

Deno.test('ErrorHandler - TID 已完成（过期）时静默忽略', async () => {
  const tid = mgr.create({ type: QueryType.PING, addr: REMOTE_ADDR, port: REMOTE_PORT })
  mgr.finish(tid) // 先完成事务

  const sender = new MockSender()
  await handler.handle(
    { t: tid, y: MessageType.ERROR, e: [203, 'already finished'] },
    REMOTE_ADDR,
    REMOTE_PORT,
    sender,
  )
  assertEquals(sender.sentMessages.length, 0)
})

// ─── 合法 TID + 有错误详情 ────────────────────────────────────────────────────

Deno.test('ErrorHandler - 合法 TID 有错误详情时完成事务', async () => {
  const tid = mgr.create({ type: QueryType.PING, addr: REMOTE_ADDR, port: REMOTE_PORT })
  assertEquals(mgr.isValid(tid), true)

  const sender = new MockSender()
  await handler.handle(
    { t: tid, y: MessageType.ERROR, e: [202, 'server error'] },
    REMOTE_ADDR,
    REMOTE_PORT,
    sender,
  )
  // 事务应已完成
  assertEquals(mgr.isValid(tid), false)
  // 错误响应不发送任何回复
  assertEquals(sender.sentMessages.length, 0)
})

Deno.test('ErrorHandler - 合法 TID 无错误字段时完成事务（unknown error）', async () => {
  const tid = mgr.create({ type: QueryType.FIND_NODE, addr: REMOTE_ADDR, port: REMOTE_PORT })
  assertEquals(mgr.isValid(tid), true)

  const sender = new MockSender()
  await handler.handle(
    { t: tid, y: MessageType.ERROR }, // 缺少 e 字段
    REMOTE_ADDR,
    REMOTE_PORT,
    sender,
  )
  assertEquals(mgr.isValid(tid), false)
})

// ─── 不同查询类型的事务都能正常完成 ─────────────────────────────────────────

Deno.test('ErrorHandler - GET_PEERS 事务收到错误响应后完成', async () => {
  const infoHash = new Uint8Array(20).fill(0xab)
  const tid = mgr.create({ type: QueryType.GET_PEERS, addr: REMOTE_ADDR, port: REMOTE_PORT, infoHash })

  const sender = new MockSender()
  await handler.handle(
    { t: tid, y: MessageType.ERROR, e: [201, 'generic error'] },
    REMOTE_ADDR,
    REMOTE_PORT,
    sender,
  )
  assertEquals(mgr.isValid(tid), false)
})

Deno.test('ErrorHandler - ANNOUNCE_PEER 事务收到错误响应后完成', async () => {
  const tid = mgr.create({ type: QueryType.ANNOUNCE_PEER, addr: REMOTE_ADDR, port: REMOTE_PORT })

  const sender = new MockSender()
  await handler.handle(
    { t: tid, y: MessageType.ERROR, e: [204, 'method unknown'] },
    REMOTE_ADDR,
    REMOTE_PORT,
    sender,
  )
  assertEquals(mgr.isValid(tid), false)
})

// ─── getHandleMessageType ─────────────────────────────────────────────────────

Deno.test('ErrorHandler.getHandleMessageType - 返回 ERROR 类型', () => {
  assertEquals(handler.getHandleMessageType(), MessageType.ERROR)
})

// ─── PING 和 FIND_NODE 事务的错误响应 ─────────────────────────────────────────

Deno.test('ErrorHandler - PING 事务收到错误响应后完成', async () => {
  const tid = mgr.create({ type: QueryType.PING, addr: REMOTE_ADDR, port: REMOTE_PORT })
  assertEquals(mgr.isValid(tid), true)

  const sender = new MockSender()
  await handler.handle(
    { t: tid, y: MessageType.ERROR, e: [201, 'generic error'] },
    REMOTE_ADDR,
    REMOTE_PORT,
    sender,
  )
  assertEquals(mgr.isValid(tid), false)
  assertEquals(sender.sentMessages.length, 0)
})

Deno.test('ErrorHandler - FIND_NODE 事务收到错误响应后完成', async () => {
  const tid = mgr.create({ type: QueryType.FIND_NODE, addr: REMOTE_ADDR, port: REMOTE_PORT })
  assertEquals(mgr.isValid(tid), true)

  const sender = new MockSender()
  await handler.handle(
    { t: tid, y: MessageType.ERROR, e: [204, 'method unknown'] },
    REMOTE_ADDR,
    REMOTE_PORT,
    sender,
  )
  assertEquals(mgr.isValid(tid), false)
  assertEquals(sender.sentMessages.length, 0)
})
