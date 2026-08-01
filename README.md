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
import { DHT, RoutingTable } from '@deno-torrent/torrent-dht'

const dht = await DHT.listen(6881)

setInterval(async () => {
  if (RoutingTable.get().nodeCount < 16) {
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

### RoutingTable (singleton)

| Method / Property                 | Description                                |
| --------------------------------- | ------------------------------------------ |
| `RoutingTable.get()`              | Get the singleton instance                 |
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
verify the JSR package contents locally, run `deno publish --dry-run`.

## Protocol Safety

Incoming KRPC datagrams are decoded with UDP-size and nesting limits. Malformed message shapes are dropped, and response
or error packets are accepted only when their source IP and port match the original request. Unknown query methods
receive the BEP-5 `204 Method Unknown` error.

Call `dht.close()` when the node is no longer needed so its UDP socket is released.

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
import { DHT, RoutingTable } from '@deno-torrent/torrent-dht'

const dht = await DHT.listen(6881)

setInterval(async () => {
  if (RoutingTable.get().nodeCount < 16) {
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

### RoutingTable（单例）

| 方法 / 属性                       | 说明                         |
| --------------------------------- | ---------------------------- |
| `RoutingTable.get()`              | 获取单例实例                 |
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
包内容。

## 协议安全

入站 KRPC 数据报受 UDP 大小和嵌套深度限制。结构异常的消息会被丢弃；响应或错误报文仅在来源
IP、端口与原请求目标一致时才会被接受。未知查询方法会收到 BEP-5 的 `204 Method Unknown` 错误。

节点不再使用时请调用 `dht.close()`，以释放 UDP socket。

## 从 1.x 迁移

版本 2 将 `@deno-torrent/bencode` 和 `@deno-torrent/toolkit` 升级到 2.0 API。`Id`、`Bucket` 等公共 API 暴露的 `BitArray`
现在使用输入复制及读取时复制语义。完整说明见 [MIGRATION_2.0.md](./MIGRATION_2.0.md)。

## 许可证

[MIT](./LICENSE) © 2024 deno-torrent
