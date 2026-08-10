import { assertEquals } from '@std/assert'
import { type DatagramTransport, DHT, Id } from '../mod.ts'

class CallerOwnedTransport implements DatagramTransport {
  closed = false

  send(data: Uint8Array): Promise<number> {
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
