/**
 * TransactionManager（事务管理器）测试
 */
import { assertEquals, assertNotEquals } from '@std/assert'
import TransactionManager from '../src/krpc/transaction_manager.ts'
import { QueryType } from '../src/message_factory.ts'

// 注意：TransactionManager 是单例，使用全局共享实例进行测试
const mgr = TransactionManager.get()

// ─── create / isValid / finish ────────────────────────────────────────────────

Deno.test('TransactionManager.create - 创建事务并返回合法 TID', () => {
  const tid = mgr.create({ type: QueryType.PING, addr: '1.2.3.4', port: 6881 })
  assertEquals(typeof tid, 'string')
  assertEquals(tid.length, 2)
  // 清理
  mgr.finish(tid)
})

Deno.test('TransactionManager.create - 多次创建返回不同 TID', () => {
  const tid1 = mgr.create({ type: QueryType.PING, addr: '1.2.3.4', port: 6881 })
  const tid2 = mgr.create({ type: QueryType.PING, addr: '1.2.3.4', port: 6881 })
  assertNotEquals(tid1, tid2)
  mgr.finish(tid1)
  mgr.finish(tid2)
})

Deno.test('TransactionManager.isValid - 新建事务有效', () => {
  const tid = mgr.create({ type: QueryType.FIND_NODE, addr: '2.3.4.5', port: 1234 })
  assertEquals(mgr.isValid(tid), true)
  mgr.finish(tid)
})

Deno.test('TransactionManager.isValid - finish 后事务失效', () => {
  const tid = mgr.create({ type: QueryType.GET_PEERS, addr: '3.4.5.6', port: 5678 })
  mgr.finish(tid)
  assertEquals(mgr.isValid(tid), false)
})

Deno.test('TransactionManager.isValid - 不存在的 TID 返回 false', () => {
  assertEquals(mgr.isValid('ZZ'), false)
})

// ─── getData ──────────────────────────────────────────────────────────────────

Deno.test('TransactionManager.getData - 返回创建时附加的数据', () => {
  const data = { type: QueryType.PING, addr: '9.9.9.9', port: 9999 }
  const tid = mgr.create(data)
  const got = mgr.getData(tid)
  assertEquals(got?.addr, '9.9.9.9')
  assertEquals(got?.port, 9999)
  mgr.finish(tid)
})

Deno.test('TransactionManager.getData - 无效 TID 返回 undefined', () => {
  assertEquals(mgr.getData('ZZ'), undefined)
})

Deno.test('TransactionManager.finish - 重复 finish 不报错', () => {
  const tid = mgr.create({ type: QueryType.PING, addr: '1.1.1.1', port: 11 })
  mgr.finish(tid)
  mgr.finish(tid) // 第二次调用应安全跳过
  assertEquals(mgr.isValid(tid), false)
})

Deno.test('TransactionManager.getData - finish 后返回 undefined', () => {
  const data = { type: QueryType.GET_PEERS, addr: '5.5.5.5', port: 5555 }
  const tid = mgr.create(data)
  mgr.finish(tid)
  // finish 之后 getData 应返回 undefined
  assertEquals(mgr.getData(tid), undefined)
})

Deno.test('TransactionManager.finish - 对不存在的 TID 不抛出异常', () => {
  // 随机两字符串，几乎不可能是活跃事务
  mgr.finish('!!')
})
