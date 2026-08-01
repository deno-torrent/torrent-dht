# @deno-torrent/torrent-dht

[![JSR](https://jsr.io/badges/@deno-torrent/torrent-dht)](https://jsr.io/@deno-torrent/torrent-dht)
[![JSR Score](https://jsr.io/badges/@deno-torrent/torrent-dht/score)](https://jsr.io/@deno-torrent/torrent-dht)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

BitTorrent DHT ([BEP-5](http://bittorrent.org/beps/bep_0005.html)) implementation in pure Deno / TypeScript.

Requires the current stable Deno 2.x release.

[中文文档](#中文文档)

---

## Installation

```ts
import { DHT } from 'jsr:@deno-torrent/torrent-dht@^2.0.0'
```

Or add to `deno.jsonc`:

```jsonc
{
  "imports": {
    "@deno-torrent/torrent-dht": "jsr:@deno-torrent/torrent-dht@^2.0.0"
  }
}
```

## Quick Start

```ts
import { DHT } from '@deno-torrent/torrent-dht'

const dht = await DHT.listen(6881)

setInterval(async () => {
  if (dht.routingTable.nodeCount < 16) {
    await dht.pingBootstrapNodes()
    await dht.sendFindNodeRequest()
  }
}, 5000)

const infoHash = new Uint8Array(20) // replace with real info hash
await dht.sendGetPeersRequest(infoHash)
```

Run applications that call `DHT.listen()` with `--unstable-net`, because Deno 2.x still gates UDP datagram sockets
behind that flag:

```bash
deno run -A --unstable-net your_app.ts
```

## API Reference

### DHT

| Method                              | Description                                         |
| ----------------------------------- | --------------------------------------------------- |
| `DHT.listen(port, bootstrapNodes?)` | Create and start a DHT node, returns `Promise<DHT>` |
| `dht.pingBootstrapNodes()`          | Send ping + find_node to all bootstrap nodes        |
| `dht.sendFindNodeRequest()`         | Send find_node to known routing table nodes         |
| `dht.sendGetPeersRequest(infoHash)` | Send get_peers to the closest known nodes           |
| `dht.close()`                       | Close the UDP socket; repeated calls are safe       |

### RoutingTable

| Method / Property                 | Description                                |
| --------------------------------- | ------------------------------------------ |
| `dht.routingTable`                | Get this DHT instance's routing table      |
| `rt.nodeCount`                    | Total number of nodes in the routing table |
| `rt.add(node)`                    | Add a node                                 |
| `rt.remove(node)`                 | Remove a node                              |
| `rt.findClosestNodes(id, count?)` | Find N closest nodes by XOR distance       |
| `rt.getAllNodes()`                | Get all known nodes                        |

## Running Tests

```bash
deno task fmt
deno task lint
deno task check
deno task test
```

The default test task is deterministic and excludes tests that open a UDP socket or contact public services. Run those
separately when the environment permits:

```bash
deno task test:integration
deno task test:network
```

Both optional tasks require network access. `test:network` also depends on public DHT bootstrap nodes and can fail when
UDP traffic or those nodes are unavailable; it is intentionally not part of the default CI gate.

## Development

Use the current stable Deno 2.x release. Before opening a pull request, run the four default quality tasks above. To
verify the JSR package contents locally, run `deno publish --dry-run`. Maintainers should follow
[RELEASING.md](./RELEASING.md) for the version, tag, and tokenless JSR publication process.

## Protocol Safety

Incoming KRPC datagrams are decoded with UDP-size and nesting limits. Malformed message shapes are dropped, and response
or error packets are accepted only when their source IP and port match the original request. Unknown query methods
receive the BEP-5 `204 Method Unknown` error.

`get_peers` announce tokens are bound to the requester's IP address, rotate every five minutes, and remain valid for at
most one previous rotation window. Tokens are exposed as opaque `Uint8Array` values and may contain non-UTF-8 bytes. An
`announce_peer` request without a valid issued token is rejected.

When a K-bucket is full, the least-recently-seen node is pinged before replacement. A responsive node is retained; only
a failed or timed-out probe permits the newcomer to replace it. Outbound UDP failures reject the request promise and
release its transaction immediately.

Call `dht.close()` when the node is no longer needed so its UDP socket is released.

## Error Handling

Invalid argument types use `TypeError`; numeric values outside their supported range use `RangeError`. Network and
environment initialization failures reject `DHT.listen()` with an `Error`. Public IPv4 discovery is validated and
limited to 10 seconds, so environments that block HTTPS fail instead of leaving startup pending. Always release a
successfully created node:

```ts
let dht: DHT | undefined
try {
  dht = await DHT.listen(6881)
  // use dht
} catch (error) {
  if (error instanceof RangeError) {
    console.error('Invalid DHT configuration:', error.message)
  } else {
    console.error('Could not start DHT:', error)
  }
} finally {
  dht?.close()
}
```

## Limits and Non-goals

- Node IDs and info hashes must be exactly 20 bytes.
- Compact nodes and peers currently support IPv4 only.
- Routing and peer state is held in process memory and is not persisted.
- Peer endpoints are deduplicated, expire after 30 minutes without refresh, and are bounded to 100 peers per info hash
  and 10,000 info hashes per process.
- The routing table and managers are process-wide singletons; use one active DHT node per Deno worker.
- **Intentional non-goal:** this package is a BEP-5 DHT component, not a complete BitTorrent client, tracker, storage
  engine, or IPv6 DHT implementation.

## Migrating from 1.x

Version 2 upgrades `@deno-torrent/bencode` and `@deno-torrent/toolkit` to their 2.0 APIs. The public `BitArray` values
exposed by `Id` and `Bucket` now use copy-on-read byte ownership. See [MIGRATION_2.0.md](./MIGRATION_2.0.md).

## License

[MIT](./LICENSE) © 2024 deno-torrent

---

## 中文文档

BEP-5 DHT 协议（[BEP-5](http://bittorrent.org/beps/bep_0005.html)）的纯 Deno / TypeScript 实现。

需要当前稳定版 Deno 2.x。

## 安装

```ts
import { DHT } from 'jsr:@deno-torrent/torrent-dht@^2.0.0'
```

或在 `deno.jsonc` 中配置：

```jsonc
{
  "imports": {
    "@deno-torrent/torrent-dht": "jsr:@deno-torrent/torrent-dht@^2.0.0"
  }
}
```

## 快速开始

```ts
import { DHT } from '@deno-torrent/torrent-dht'

const dht = await DHT.listen(6881)

setInterval(async () => {
  if (dht.routingTable.nodeCount < 16) {
    await dht.pingBootstrapNodes()
    await dht.sendFindNodeRequest()
  }
}, 5000)

const infoHash = new Uint8Array(20) // 替换为真实 info hash
await dht.sendGetPeersRequest(infoHash)
```

调用 `DHT.listen()` 的应用需要使用 `--unstable-net` 启动，因为 Deno 2.x 仍将 UDP 数据报 socket 置于该标志之后：

```bash
deno run -A --unstable-net your_app.ts
```

## API

### DHT 类

| 方法                                | 说明                                     |
| ----------------------------------- | ---------------------------------------- |
| `DHT.listen(port, bootstrapNodes?)` | 创建并启动 DHT 节点，返回 `Promise<DHT>` |
| `dht.pingBootstrapNodes()`          | 向所有引导节点发送 ping + find_node      |
| `dht.sendFindNodeRequest()`         | 向路由表中已知节点发送 find_node         |
| `dht.sendGetPeersRequest(infoHash)` | 向最近节点发送 get_peers 请求            |
| `dht.close()`                       | 关闭 UDP socket；重复调用安全            |

### RoutingTable

| 方法 / 属性                       | 说明                         |
| --------------------------------- | ---------------------------- |
| `dht.routingTable`                | 获取当前 DHT 实例的路由表    |
| `rt.nodeCount`                    | 当前路由表节点总数           |
| `rt.add(node)`                    | 添加节点                     |
| `rt.remove(node)`                 | 移除节点                     |
| `rt.findClosestNodes(id, count?)` | 找到 XOR 距离最近的 N 个节点 |
| `rt.getAllNodes()`                | 获取所有已知节点             |

## 运行测试

```bash
deno task fmt
deno task lint
deno task check
deno task test
```

默认测试任务只运行确定性的测试，不包含会打开 UDP socket 或访问公网服务的测试。网络环境允许时可分别运行：

```bash
deno task test:integration
deno task test:network
```

两个可选任务都需要网络权限。`test:network` 还依赖公网 DHT 引导节点；如果 UDP
流量受限或引导节点不可用，测试可能失败，因此它被明确排除在默认 CI 门禁之外。

## 开发

请使用当前稳定版 Deno 2.x。提交 Pull Request 前运行上述四个默认质量任务；可使用 `deno publish --dry-run` 在本地验证 JSR
包内容。维护者发布新版本时应遵循 [RELEASING.md](./RELEASING.md) 中的版本、Tag 与无 Token JSR 发布流程。

## 协议安全

入站 KRPC 数据报受 UDP 大小和嵌套深度限制。结构异常的消息会被丢弃；响应或错误报文仅在来源
IP、端口与原请求目标一致时才会被接受。未知查询方法会收到 BEP-5 的 `204 Method Unknown` 错误。

`get_peers` 的 announce token 与请求方 IP 绑定，每五分钟轮换，并且最多保留前一个轮换窗口。未携带有效已签发 token 的
`announce_peer` 请求会被拒绝。Token 以 opaque `Uint8Array` 暴露，允许包含非 UTF-8 字节。

K-bucket 满时会先 ping 最久未活动节点；有响应则保留旧节点，仅在发送失败、错误响应或超时后才允许新节点替换。 出站 UDP
发送失败会拒绝请求 Promise，并立即释放对应事务。

节点不再使用时请调用 `dht.close()`，以释放 UDP socket。

## 错误处理

参数类型错误使用 `TypeError`，数值超出允许范围使用 `RangeError`。网络或运行环境初始化失败时，`DHT.listen()` 会以 `Error`
拒绝。公网 IPv4 探测会验证响应并限制为 10 秒，因此禁止 HTTPS
的环境会明确失败，而不会让启动一直等待。成功创建节点后应始终释放资源：

```ts
let dht: DHT | undefined
try {
  dht = await DHT.listen(6881)
  // 使用 dht
} catch (error) {
  if (error instanceof RangeError) {
    console.error('DHT 配置无效：', error.message)
  } else {
    console.error('DHT 启动失败：', error)
  }
} finally {
  dht?.close()
}
```

## 限制与非目标

- 节点 ID 和 info hash 必须恰好为 20 字节。
- 紧凑节点和 Peer 地址目前仅支持 IPv4。
- 路由与 Peer 状态只保存在进程内存中，不提供持久化。
- Peer endpoint 会去重，连续 30 分钟未刷新即过期；每个 info hash 最多保留 100 个 Peer，每个进程最多保留 10,000 个 info
  hash。
- 路由表和管理器是进程级单例；每个 Deno worker 只应运行一个活动 DHT 节点。
- **明确非目标：**本库是 BEP-5 DHT 组件，不是完整的 BitTorrent 客户端、Tracker、存储引擎或 IPv6 DHT 实现。

## 从 1.x 迁移

版本 2 将 `@deno-torrent/bencode` 和 `@deno-torrent/toolkit` 升级到 2.0 API。`Id`、`Bucket` 等公共 API 暴露的 `BitArray`
现在使用输入复制及读取时复制语义。完整说明见 [MIGRATION_2.0.md](./MIGRATION_2.0.md)。

## 许可证

[MIT](./LICENSE) © 2024 deno-torrent
