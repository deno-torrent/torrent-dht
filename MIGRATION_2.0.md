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
