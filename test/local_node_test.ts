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
