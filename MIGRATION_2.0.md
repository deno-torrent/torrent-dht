# Migrating from 1.x to 2.0 / 从 1.x 迁移到 2.0

Version 2 upgrades `@deno-torrent/bencode` and `@deno-torrent/toolkit` to 2.0.0. No torrent-dht feature was removed, but
the toolkit types exposed through the public API have breaking ownership and construction changes.

## Imports

The package exports named values from its root entry point:

```ts
import { DHT, Id, RoutingTable } from 'jsr:@deno-torrent/torrent-dht@^2.0.0'
```

The previously documented default import and `/routing_table` subpath were not exported by 1.x and should be replaced
with root named imports.

## BitArray migration

`Id.bits`, the `Bucket` constructor, and routing-table APIs expose `BitArray` from `@deno-torrent/toolkit`.

```ts
// 1.x
const bits = BitArray.fromUnit8Array(bytes)

// 2.0
const bits = BitArray.fromUint8Array(bytes)
```

In toolkit 2.0, `fromUint8Array()` copies its input and `.bytes` returns a copy. Mutating either byte array no longer
mutates the `BitArray`. `xor()` also throws `RangeError` when operands have different lengths; DHT node IDs and info
hashes must remain exactly 20 bytes.

## Bencode migration

Bencode 2.0 uses `Map` dictionaries, a synchronous codec, strict canonical decoding, and explicit resource limits.
`MessageFactory` preserves its existing asynchronous public methods and converts KRPC message objects internally, so
normal torrent-dht consumers do not need to construct Bencode maps.

Malformed, non-canonical, deeply nested, or oversized KRPC datagrams are now rejected during decoding.

Input validation now uses the built-in `TypeError` and `RangeError` classes where applicable. The misspelled
`Id.toIntSting()` and `BlackListManager.isBaned()` methods remain available but are deprecated; new code should use
`Id.toIntString()` and `BlackListManager.isBanned()`.

## Opaque KRPC tokens

KRPC announce tokens are now represented as `Uint8Array`, matching BEP 5's opaque byte-string definition. Update calls
to `MessageFactory.requestAnnouncePeer()`, `MessageFactory.responseGetPeers()`, `InfoHashManager.add()` and
`sendAnnouncePeerRequest()` to pass bytes rather than text:

```ts
const token = new TextEncoder().encode(previousStringToken)
```

Decoded tokens may contain arbitrary non-UTF-8 bytes. Token inputs and stored tokens use copy ownership.

## Instance-owned state

`RoutingTable`, `InfoHashManager`, `TransactionManager`, and `TokenManager` are no longer process-wide singletons. Every
`DHT` owns independent routing, peer, transaction, and announce-token state. Replace singleton access with the instance
properties:

```ts
// 1.x
RoutingTable.get().nodeCount
InfoHashManager.get().find(infoHash)

// 2.0
dht.routingTable.nodeCount
dht.infoHashManager.find(infoHash)
```

Direct consumers construct manager classes with `new`. KRPC response factory methods now require the responding local
node ID explicitly, for example `MessageFactory.responsePing(tid, localNodeId)`.

## Routing and send failures

Full K-buckets no longer evict their oldest entry synchronously. `Bucket.add()` returns `false` while full;
`Bucket.replace()` and `RoutingTable.replace()` are explicit operations used after a failed liveness probe. DHT-managed
discovery performs the BEP 5 ping-before-replace flow automatically.

KRPC send methods now reject when UDP transmission fails. The associated transaction is released before rejection, so
callers should handle the returned promise rather than relying only on logs.

## DHT listen options

`DHT.listen()` now accepts an options object. This separates the local bind interface from the IPv4 address advertised
to other DHT nodes and allows restricted deployments to bypass ipify:

```ts
// 1.x
await DHT.listen(6881, bootstrapNodes)

// 2.0
await DHT.listen({
  port: 6881,
  bootstrapNodes,
  bindAddress: '0.0.0.0',
  publicAddress: '203.0.113.10', // omit only when automatic discovery is desired
})
```

`nodeId` can be supplied to bypass MAC-derived ID creation, and `autoBootstrap: false` disables construction-time
bootstrap requests.

## Runtime and permissions

Version 2 supports the current stable Deno 2.x line. Toolkit 2.0 obtains MAC addresses through
`Deno.networkInterfaces()` instead of spawning an operating-system command. Restricted deployments must allow network
access for DHT traffic and access to system network-interface information when calling `DHT.listen()`.

---

版本 2 将两个底层依赖升级到 2.0.0。普通 DHT 功能没有被删除，但公共 API 暴露的 `BitArray` 已采用 toolkit 2.0
的构造和所有权语义：使用 `fromUint8Array()`，输入与 `.bytes` 输出都会复制，且不同长度的 `xor()` 会抛出 `RangeError`。

Bencode 2.0 改用 `Map` 字典、同步编解码和严格规范校验。`MessageFactory` 保留原有异步公共签名并在内部
转换，因此一般调用方无需直接迁移 KRPC 消息对象。

版本 2 支持当前稳定版 Deno 2.x。Toolkit 2.0 改用 `Deno.networkInterfaces()` 获取 MAC 地址，不再启动系统
命令；受限部署调用 `DHT.listen()` 时需要允许 DHT 网络访问和系统网络接口信息访问。
