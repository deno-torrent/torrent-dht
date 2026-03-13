/**
 * DHT 集成测试（对应 main.ts 核心逻辑）
 *
 * 测试 DHT.listen()、sendGetPeersRequest()、sendFindNodeRequest()、pingBootstrapNodes()。
 * 这些测试会绑定真实 UDP 端口，因此使用 sanitizeResources/sanitizeOps: false。
 *
 * 注意：DHT.listen() 内部通过 ifconfig / ipconfig 获取 MAC 地址来生成节点 ID。
 * 若运行环境中缺少相应命令（如 Docker 精简容器），初始化将失败，测试自动跳过。
 */
import { assertEquals } from '@std/assert'
import DHT from '../src/dht.ts'
import RoutingTable from '../src/routing_table.ts'
import { sha1 } from '../src/util/hash.ts'

const TEST_PORT = 59999

// 容错初始化：缺少 ifconfig/ipconfig 的环境中优雅跳过
let dht: DHT | undefined
let skipReason: string | undefined
try {
  dht = await DHT.listen(TEST_PORT)
} catch (e) {
  skipReason = `DHT.listen() 初始化失败（环境可能缺少 ifconfig）: ${(e as Error).message}`
}

const skip = dht === undefined

// ─── DHT.listen ──────────────────────────────────────────────────────────────

Deno.test({
  name: 'DHT.listen - 返回 DHT 实例',
  ignore: skip,
  sanitizeResources: false,
  sanitizeOps: false,
  fn() {
    assertEquals(dht instanceof DHT, true)
  },
})

Deno.test({
  name: 'DHT.listen - 路由表已初始化（本地节点存在）',
  ignore: skip,
  sanitizeResources: false,
  sanitizeOps: false,
  fn() {
    const rt = RoutingTable.get()
    assertEquals(rt.localNode !== undefined, true)
    assertEquals(rt.localNode.port, TEST_PORT)
  },
})

Deno.test({
  name: 'DHT.listen - 路由表包含 160 个桶',
  ignore: skip,
  sanitizeResources: false,
  sanitizeOps: false,
  fn() {
    assertEquals(RoutingTable.get().buckets.length, 160)
  },
})

// ─── sendGetPeersRequest ─────────────────────────────────────────────────────

Deno.test({
  name: 'DHT.sendGetPeersRequest - 20 字节全零 infoHash 不抛出',
  ignore: skip,
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    await dht!.sendGetPeersRequest(new Uint8Array(20))
  },
})

Deno.test({
  name: 'DHT.sendGetPeersRequest - SHA-1 infoHash 不抛出',
  ignore: skip,
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    // 对应 main.ts 中 parse(magnetLink).hash 的用法
    const infoHash = sha1(new TextEncoder().encode('ubuntu-22.04.2-live-server-amd64.iso'))
    await dht!.sendGetPeersRequest(infoHash)
  },
})

// ─── sendFindNodeRequest ─────────────────────────────────────────────────────

Deno.test({
  name: 'DHT.sendFindNodeRequest - 遍历路由表中所有节点，不抛出',
  ignore: skip,
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    await dht!.sendFindNodeRequest()
  },
})

// ─── pingBootstrapNodes ──────────────────────────────────────────────────────

Deno.test({
  name: 'DHT.pingBootstrapNodes - 向引导节点发送 ping，不抛出',
  ignore: skip,
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    await dht!.pingBootstrapNodes()
  },
})

// 如果初始化失败，打印原因便于排查
if (skipReason) {
  console.warn(`\n[dht_test] 所有 DHT 测试已跳过：${skipReason}\n`)
}
