import { assertEquals } from '@std/assert'
import Id from '../src/id.ts'
import LocalNode from '../src/local_node.ts'

Deno.test('LocalNode.createLocalNode - explicit address and ID avoid automatic discovery', async () => {
  const nodeId = Id.random()
  const node = await LocalNode.createLocalNode(6881, {
    publicAddress: '203.0.113.10',
    nodeId,
  })

  assertEquals(node.id.equals(nodeId), true)
  assertEquals(node.addr, '203.0.113.10')
  assertEquals(node.port, 6881)
})

Deno.test({
  name: 'LocalNode.createLocalNode - default ID does not require system information',
  permissions: { net: false, sys: false },
  fn: async () => {
    const node = await LocalNode.createLocalNode(6881, { publicAddress: '203.0.113.10' })

    assertEquals(node.id.bits.bytes.length, Id.BYTES_LENGTH)
    assertEquals(node.addr, '203.0.113.10')
  },
})

Deno.test({
  name: 'LocalNode.createLocalNode - default startup does not require network access',
  permissions: { net: false, sys: false },
  fn: async () => {
    const node = await LocalNode.createLocalNode(6881)

    assertEquals(node.id.bits.bytes.length, Id.BYTES_LENGTH)
    assertEquals(node.addr, '0.0.0.0')
  },
})

Deno.test('LocalNode.createLocalNode - bind address is used without a public address', async () => {
  const node = await LocalNode.createLocalNode(6881, { bindAddress: '192.168.1.20' })

  assertEquals(node.addr, '192.168.1.20')
})
