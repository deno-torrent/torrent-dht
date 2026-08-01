import { assertEquals, assertRejects } from '@std/assert'
import Id from '../src/id.ts'
import InfoHashManager from '../src/info_hash_manager.ts'
import { DatagramTransport, KRPC } from '../src/krpc/krpc.ts'
import TokenManager from '../src/krpc/token_manager.ts'
import TransactionManager, { Request } from '../src/krpc/transaction_manager.ts'
import LocalNode from '../src/local_node.ts'
import MessageFactory, { MessageType } from '../src/message_factory.ts'
import Node from '../src/node.ts'
import RoutingTable from '../src/routing_table.ts'

class FakeTransport implements DatagramTransport {
  onSend?: (data: Uint8Array, address: Deno.Addr) => void | Promise<void>
  error?: Error

  async send(data: Uint8Array, address: Deno.Addr): Promise<number> {
    if (this.error) throw this.error
    await this.onSend?.(data, address)
    return data.length
  }

  close(): void {}

  async *[Symbol.asyncIterator](): AsyncGenerator<[Uint8Array, Deno.Addr]> {}
}

function makeContext(probeTimeoutMs = 20) {
  const localNode = new LocalNode(Id.random(), 0, '127.0.0.1')
  const routingTable = new RoutingTable(localNode)
  const infoHashManager = new InfoHashManager()
  const transactionManager = new TransactionManager<Request>()
  const tokenManager = new TokenManager()
  const transport = new FakeTransport()
  const krpc = KRPC.create(
    0,
    routingTable,
    infoHashManager,
    transactionManager,
    tokenManager,
    '0.0.0.0',
    transport,
    probeTimeoutMs,
  )
  return { krpc, routingTable, transactionManager, transport }
}

function nodesInOneRemoteBucket(localNode: LocalNode): [Node, Node] {
  const firstByte = localNode.id.bits.bytes[0] & 0x80 ? 0x00 : 0x80
  const oldestBytes = new Uint8Array(20)
  oldestBytes[0] = firstByte
  const replacementBytes = oldestBytes.slice()
  replacementBytes[19] = 1
  return [
    new Node(Id.fromUnit8Array(oldestBytes), 7001, '192.0.2.1'),
    new Node(Id.fromUnit8Array(replacementBytes), 7002, '192.0.2.2'),
  ]
}

Deno.test('KRPC - send failure rejects and releases its transaction', async () => {
  const { krpc, transactionManager, transport } = makeContext()
  transport.error = new Error('injected UDP failure')

  await assertRejects(
    () => krpc.sendPingRequest(new Node(Id.random(), 6881, '192.0.2.10')),
    Error,
    'failed to send KRPC message',
  )
  assertEquals(transactionManager.size, 0)
  krpc.close()
})

Deno.test('KRPC - full bucket replaces oldest node only after probe timeout', async () => {
  const previousCapacity = RoutingTable.BUCKET_CAPACITY
  RoutingTable.BUCKET_CAPACITY = 1
  try {
    const { krpc, routingTable, transactionManager } = makeContext(5)
    const [oldest, replacement] = nodesInOneRemoteBucket(routingTable.localNode)
    routingTable.add(oldest)

    assertEquals(await krpc.considerNode(replacement), true)
    assertEquals(routingTable.findNode(oldest.id), undefined)
    assertEquals(routingTable.findNode(replacement.id) !== undefined, true)
    assertEquals(transactionManager.size, 0)
    krpc.close()
  } finally {
    RoutingTable.BUCKET_CAPACITY = previousCapacity
  }
})

Deno.test('KRPC - responsive oldest node is retained and newcomer is discarded', async () => {
  const previousCapacity = RoutingTable.BUCKET_CAPACITY
  RoutingTable.BUCKET_CAPACITY = 1
  try {
    const context = makeContext()
    const { krpc, routingTable, transport } = context
    const [oldest, replacement] = nodesInOneRemoteBucket(routingTable.localNode)
    routingTable.add(oldest)
    transport.onSend = async (data) => {
      const request = await MessageFactory.decode(data)
      await krpc.dispatchMessage(
        { t: request!.t, y: MessageType.RESPONSE, r: { id: oldest.id.bits.bytes } },
        oldest.addr,
        oldest.port,
      )
    }

    assertEquals(await krpc.considerNode(replacement), false)
    assertEquals(routingTable.findNode(oldest.id) !== undefined, true)
    assertEquals(routingTable.findNode(replacement.id), undefined)
    krpc.close()
  } finally {
    RoutingTable.BUCKET_CAPACITY = previousCapacity
  }
})
