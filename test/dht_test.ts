/**
 * DHT 集成测试（对应 main.ts 核心逻辑）
 *
 * 测试 DHT.listen()、sendGetPeersRequest()、sendFindNodeRequest()、pingBootstrapNodes()。
 * 这些测试会绑定真实 UDP 端口，因此使用 sanitizeResources/sanitizeOps: false。
 *
 * 注意：DHT.listen() 内部通过 ifconfig / ipconfig 获取 MAC 地址来生成节点 ID。
 * 若运行环境中缺少相应命令（如 Docker 精简容器），初始化将失败，测试自动跳过。
 */
import { assertEquals, assertRejects } from '@std/assert'
import DHT from '../src/dht.ts'
import Id from '../src/id.ts'
import Node from '../src/node.ts'
import Peer from '../src/peer.ts'
import { sha1 } from '../src/util/hash.ts'

const TEST_PORT = 59999

// 容错初始化：缺少 ifconfig/ipconfig 的环境中优雅跳过
let dht: DHT | undefined
let skipReason: string | undefined
try {
  dht = await DHT.listen({ port: TEST_PORT, publicAddress: '127.0.0.1', autoBootstrap: false })
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
    const rt = dht!.routingTable
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
    assertEquals(dht!.routingTable.buckets.length, 160)
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

Deno.test({
  name: 'DHT.pingBootstrapNodes - 单个入口 DNS 失败不会中止引导流程',
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const resilientDht = await DHT.listen({
      port: 0,
      publicAddress: '127.0.0.1',
      nodeId: Id.random(),
      bootstrapNodes: [
        { addr: 'does-not-exist.invalid', port: 6881 },
        { addr: '127.0.0.1', port: 9 },
      ],
      autoBootstrap: false,
    })

    try {
      await resilientDht.pingBootstrapNodes()
    } finally {
      resilientDht.close()
    }
  },
})

Deno.test({
  name: 'DHT.close - 可重复关闭并释放 UDP socket',
  ignore: skip,
  sanitizeResources: false,
  sanitizeOps: false,
  fn() {
    dht!.close()
    dht!.close()
  },
})

Deno.test({
  name: 'DHT client API - iterative getPeers and token-bound announcePeer complete end to end',
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const firstPort = reserveUdpPort()
    const firstId = Id.random()
    const secondId = Id.random()
    const common = {
      publicAddress: '127.0.0.1',
      autoBootstrap: false,
      bootstrapNodes: [{ addr: '127.0.0.1', port: 9 }],
    }
    const first = await DHT.listen({ ...common, port: firstPort, nodeId: firstId })
    const secondPort = reserveUdpPort()
    const second = await DHT.listen({ ...common, port: secondPort, nodeId: secondId })
    try {
      first.routingTable.add(new Node(secondId, secondPort, '127.0.0.1'))
      second.routingTable.add(new Node(firstId, firstPort, '127.0.0.1'))

      const peerHash = sha1(new TextEncoder().encode('client-api-peer-lookup'))
      second.infoHashManager.addValidatedPeer(hex(peerHash), new Peer(51413, '127.0.0.2'))
      const observed: string[] = []
      const lookup = await first.getPeers(peerHash, {
        timeoutMs: 2_000,
        queryTimeoutMs: 500,
        onPeer: (peer) => {
          observed.push(`${peer.addr}:${peer.port}`)
        },
      })
      assertEquals(lookup.peers.map((peer) => `${peer.addr}:${peer.port}`), ['127.0.0.2:51413'])
      assertEquals(observed, ['127.0.0.2:51413'])
      assertEquals(lookup.respondingNodes, 1)
      assertEquals(lookup.exhausted, true)

      const announceHash = sha1(new TextEncoder().encode('client-api-announce'))
      await first.getPeers(announceHash, { timeoutMs: 2_000, queryTimeoutMs: 500 })
      const announced = await first.announcePeer(announceHash, {
        port: 6888,
        timeoutMs: 2_000,
        queryTimeoutMs: 500,
      })
      assertEquals(announced.announced, 1)
      assertEquals(
        second.infoHashManager.find(hex(announceHash))?.map((peer) => `${peer.addr}:${peer.port}`),
        ['127.0.0.1:6888'],
      )

      const controller = new AbortController()
      controller.abort(new DOMException('cancelled by test', 'AbortError'))
      await assertRejects(() => first.getPeers(peerHash, { signal: controller.signal }), DOMException)
    } finally {
      first.close()
      second.close()
    }
  },
})

// 如果初始化失败，打印原因便于排查
if (skipReason) {
  console.warn(`\n[dht_test] 所有 DHT 测试已跳过：${skipReason}\n`)
}

function reserveUdpPort(): number {
  const socket = Deno.listenDatagram({ transport: 'udp', hostname: '127.0.0.1', port: 0 })
  const port = (socket.addr as Deno.NetAddr).port
  socket.close()
  return port
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}
