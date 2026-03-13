# @deno-torrent/torrent-dht

[![JSR](https://jsr.io/badges/@deno-torrent/torrent-dht)](https://jsr.io/@deno-torrent/torrent-dht)
[![JSR Score](https://jsr.io/badges/@deno-torrent/torrent-dht/score)](https://jsr.io/@deno-torrent/torrent-dht)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

BitTorrent DHT ([BEP-5](http://bittorrent.org/beps/bep_0005.html)) implementation in pure Deno / TypeScript.

[中文文档](#中文文档)

---

## Installation

```ts
import DHT from 'jsr:@deno-torrent/torrent-dht'
```

Or add to `deno.jsonc`:

```jsonc
{
  "imports": {
    "@deno-torrent/torrent-dht": "jsr:@deno-torrent/torrent-dht@^1.0.0"
  }
}
```

## Quick Start

```ts
import DHT from '@deno-torrent/torrent-dht'
import RoutingTable from '@deno-torrent/torrent-dht/routing_table'

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

## API Reference

### DHT

| Method                              | Description                                         |
| ----------------------------------- | --------------------------------------------------- |
| `DHT.listen(port, bootstrapNodes?)` | Create and start a DHT node, returns `Promise<DHT>` |
| `dht.pingBootstrapNodes()`          | Send ping + find_node to all bootstrap nodes        |
| `dht.sendFindNodeRequest()`         | Send find_node to known routing table nodes         |
| `dht.sendGetPeersRequest(infoHash)` | Send get_peers to the closest known nodes           |

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
deno task test
```

## License

[MIT](./LICENSE) © 2024 deno-torrent

---

## 中文文档

BEP-5 DHT 协议（[BEP-5](http://bittorrent.org/beps/bep_0005.html)）的纯 Deno / TypeScript 实现。

## 安装

```ts
import DHT from 'jsr:@deno-torrent/torrent-dht'
```

或在 `deno.jsonc` 中配置：

```jsonc
{
  "imports": {
    "@deno-torrent/torrent-dht": "jsr:@deno-torrent/torrent-dht@^1.0.0"
  }
}
```

## 快速开始

```ts
import DHT from '@deno-torrent/torrent-dht'
import RoutingTable from '@deno-torrent/torrent-dht/routing_table'

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

## API

### DHT 类

| 方法                                | 说明                                     |
| ----------------------------------- | ---------------------------------------- |
| `DHT.listen(port, bootstrapNodes?)` | 创建并启动 DHT 节点，返回 `Promise<DHT>` |
| `dht.pingBootstrapNodes()`          | 向所有引导节点发送 ping + find_node      |
| `dht.sendFindNodeRequest()`         | 向路由表中已知节点发送 find_node         |
| `dht.sendGetPeersRequest(infoHash)` | 向最近节点发送 get_peers 请求            |

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
deno task test
```

## 许可证

[MIT](./LICENSE) © 2024 deno-torrent
