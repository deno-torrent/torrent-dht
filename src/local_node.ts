import Id from '~/src/id.ts'
import Node from '~/src/node.ts'
import { getIP } from '~/src/util/net.ts'

/**
 * LocalNode must be a Node, and it contains the node's routing table and file info hashs
 */
export default class LocalNode extends Node {
  /** Create a local DHT node. */
  constructor(id: Id, port: number, addr: string) {
    super(id, port, addr)
  }

  /** Local nodes remain active for the lifetime of the instance. */
  override isActive(): boolean {
    // for local node, it is always active
    return true
  }

  /**
   * create a local node
   * @param port the port of the node
   * @returns the local node
   */
  static async createLocalNode(
    port: number,
    options: { publicAddress?: string; nodeId?: Id } = {},
  ): Promise<LocalNode> {
    const id = options.nodeId ?? Id.createIdByMacAddr()
    const addr = options.publicAddress ?? await getIP()
    return new LocalNode(id, port, addr)
  }
}
