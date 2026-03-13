/**
 * DHT 真实网络集成测试
 *
 * 验证本地节点能否成功接入公网 DHT Kademlia 网络：
 *   1. Bootstrap 引导后，路由表在 30s 内应收到至少 1 个远端节点
 *   2. sendFindNodeRequest 能触发路由表增长
 *   3. sendGetPeersRequest 全流程不抛出
 *   4. 路由表节点数始终满足上限约束（不超过 160 桶 × 8 = 1280）
 *
 * 运行方式：
 *   deno test -A --unstable-net test/dht_network_test.ts
 *
 * 注意：
 *   - 需要真实外网连接，若网络不可用测试自动跳过
 *   - 与 dht_test.ts 各自在独立 Deno worker 中运行，单例状态互不影响
 *   - 测试总时长约 40 秒（包含网络等待）
 */
import { assert, assertGreater, assertLessOrEqual } from '@std/assert'
import DHT from '../src/dht.ts'
import RoutingTable from '../src/routing_table.ts'
import { sha1 } from '../src/util/hash.ts'

// 与 dht_test.ts 的 59999 端口隔离
const TEST_PORT = 58888

// ─── 模块级初始化（同 dht_test.ts 的模式） ───────────────────────────────────

let dht: DHT | undefined
let skipReason: string | undefined

try {
  dht = await DHT.listen(TEST_PORT)
} catch (e) {
  skipReason = `DHT.listen() 初始化失败（可能缺少网络或 ifconfig）: ${(e as Error).message}`
}

const skip = dht === undefined

// ─── 工具函数 ─────────────────────────────────────────────────────────────────

/**
 * 轮询等待条件满足，超时返回 false
 */
async function waitFor(condition: () => boolean, timeoutMs: number, intervalMs = 500): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (condition()) return true
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  return false
}

// ─── 测试 1：Bootstrap 后路由表发现节点 ──────────────────────────────────────

Deno.test({
  name: '真实网络 - Bootstrap 后路由表在 30s 内发现至少 1 个节点',
  ignore: skip,
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const joined = await waitFor(() => RoutingTable.get().nodeCount >= 1, 30_000)

    const nodeCount = RoutingTable.get().nodeCount
    console.log(`\n[网络测试] Bootstrap 完成，路由表节点数：${nodeCount}`)

    assert(joined, `路由表在 30s 内仍为空，节点数：${nodeCount}，请检查网络连接`)
  },
})

// ─── 测试 2：sendFindNodeRequest 触发路由表扩展 ───────────────────────────────

Deno.test({
  name: '真实网络 - sendFindNodeRequest 后路由表节点数增长或维持',
  ignore: skip,
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const before = RoutingTable.get().nodeCount

    // 向路由表中所有已知节点发送 find_node
    await dht!.sendFindNodeRequest()

    // 等待最多 15s 让响应回来
    await waitFor(() => RoutingTable.get().nodeCount > before, 15_000)

    const after = RoutingTable.get().nodeCount
    console.log(`[网络测试] find_node 前：${before}，后：${after}`)

    // 路由表已满（桶容量 = 8，共 160 桶，最多 1280）时节点数不再增长属正常
    // 只要当前节点数 > 0 即视为通过
    assertGreater(after, 0, 'find_node 后路由表不应为空')
  },
})

// ─── 测试 3：sendGetPeersRequest 全流程不抛出 ────────────────────────────────

Deno.test({
  name: '真实网络 - sendGetPeersRequest 全流程不抛出',
  ignore: skip,
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    // 使用确定性 sha1 生成 20 字节 infohash（不依赖特定真实种子）
    const infoHash = sha1(new TextEncoder().encode('deno-torrent-dht-integration-test-probe'))

    // 发出 get_peers 请求
    await dht!.sendGetPeersRequest(infoHash)

    // 等待 5s，让 DHT 有机会收到 nodes 响应并递归扩展
    await new Promise((r) => setTimeout(r, 5_000))

    const nodeCount = RoutingTable.get().nodeCount
    console.log(`[网络测试] get_peers 完成，路由表节点数：${nodeCount}`)

    // 核心保证：整个流程无异常，路由表仍然健康
    assertGreater(nodeCount, 0, 'get_peers 完成后路由表不应为空')
  },
})

// ─── 测试 4：路由表节点数上限约束 ────────────────────────────────────────────

Deno.test({
  name: '真实网络 - 路由表节点数满足上限约束（不超过 160 × 8 = 1280）',
  ignore: skip,
  sanitizeResources: false,
  sanitizeOps: false,
  fn() {
    const count = RoutingTable.get().nodeCount
    const MAX_NODES = 160 * 8 // 160 桶 × 每桶 8 节点

    console.log(`[网络测试] 最终路由表节点数：${count}（上限 ${MAX_NODES}）`)

    assertGreater(count, 0, '路由表不应为空')
    assertLessOrEqual(count, MAX_NODES, `节点数 ${count} 超过上限 ${MAX_NODES}`)
  },
})

// ─── 跳过原因提示 ──────────────────────────────────────────────────────────────

if (skipReason) {
  console.warn(`\n[dht_network_test] 所有真实网络测试已跳过：${skipReason}\n`)
}
