/**
 * BlackListManager 测试
 */
import { assertEquals } from '@std/assert'
import BlackListManager from '../src/black_list_manager.ts'

Deno.test('BlackListManager - 未封禁的 IP 返回 false', () => {
  const mgr = new BlackListManager()
  assertEquals(mgr.isBaned('1.2.3.4'), false)
})

Deno.test('BlackListManager.ban - 封禁后 isBaned 返回 true', () => {
  const mgr = new BlackListManager()
  mgr.ban('192.168.1.100')
  assertEquals(mgr.isBaned('192.168.1.100'), true)
})

Deno.test('BlackListManager - 封禁一个 IP 不影响其他 IP', () => {
  const mgr = new BlackListManager()
  mgr.ban('10.0.0.1')
  assertEquals(mgr.isBaned('10.0.0.1'), true)
  assertEquals(mgr.isBaned('10.0.0.2'), false)
})

Deno.test('BlackListManager - 重复封禁同一 IP 不报错', () => {
  const mgr = new BlackListManager()
  mgr.ban('5.5.5.5')
  mgr.ban('5.5.5.5') // 第二次封禁
  assertEquals(mgr.isBaned('5.5.5.5'), true)
})
