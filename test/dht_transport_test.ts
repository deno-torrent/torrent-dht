import { assertEquals } from '@std/assert'
import { type DatagramTransport, DHT, Id } from '../mod.ts'

class CallerOwnedTransport implements DatagramTransport {
  closed = false
  sends = 0

  send(data: Uint8Array): Promise<number> {
    this.sends++
    return Promise.resolve(data.length)
  }

  close(): void {
    this.closed = true
  }

  async *[Symbol.asyncIterator](): AsyncGenerator<[Uint8Array, Deno.Addr]> {}
}

Deno.test('DHT accepts and closes a caller-provided datagram transport', async () => {
  const transport = new CallerOwnedTransport()
  const dht = await DHT.listen({
    port: 6881,
    publicAddress: '127.0.0.1',
    nodeId: Id.random(),
    bootstrapNodes: [{ addr: '127.0.0.1', port: 6882 }],
    autoBootstrap: false,
    transport,
  })

  assertEquals(dht.routingTable.localNode.port, 6881)
  dht.close()
  assertEquals(transport.closed, true)
})

Deno.test('DHT coalesces concurrent bootstrap attempts', async () => {
  const transport = new CallerOwnedTransport()
  const dht = await DHT.listen({
    port: 6881,
    publicAddress: '127.0.0.1',
    nodeId: Id.random(),
    bootstrapNodes: [{ addr: '127.0.0.1', port: 6882 }],
    autoBootstrap: false,
    transport,
  })

  await Promise.all([dht.pingBootstrapNodes(), dht.pingBootstrapNodes()])

  assertEquals(transport.sends, 2)
  dht.close()
})
