import { assertRejects } from '@std/assert'
import DHT from '../src/dht.ts'

Deno.test('DHT.listen - 非法端口在网络初始化前抛出 RangeError', async () => {
  await assertRejects(() => DHT.listen(-1), RangeError, 'port must be in range')
})

Deno.test('DHT.listen - 空引导节点列表在网络初始化前抛出 TypeError', async () => {
  await assertRejects(() => DHT.listen(6881, []), TypeError, 'at least one bootstrap node')
})
