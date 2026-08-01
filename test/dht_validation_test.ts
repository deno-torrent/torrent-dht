import { assertRejects } from '@std/assert'
import DHT from '../src/dht.ts'

Deno.test('DHT.listen - 非法端口在网络初始化前抛出 RangeError', async () => {
  await assertRejects(() => DHT.listen({ port: -1 }), RangeError, 'port must be in range')
})

Deno.test('DHT.listen - 空引导节点列表在网络初始化前抛出 TypeError', async () => {
  await assertRejects(
    () => DHT.listen({ port: 6881, bootstrapNodes: [] }),
    TypeError,
    'at least one bootstrap node',
  )
})

Deno.test('DHT.listen - invalid explicit addresses fail before network initialization', async () => {
  await assertRejects(
    () => DHT.listen({ port: 6881, bindAddress: 'localhost' }),
    TypeError,
    'bindAddress must be an IPv4 address',
  )
  await assertRejects(
    () => DHT.listen({ port: 6881, publicAddress: 'not-an-ip' }),
    TypeError,
    'publicAddress must be an IPv4 address',
  )
})
