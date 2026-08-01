import Id from '~/src/id.ts'
import InfoHashManager from '~/src/info_hash_manager.ts'
import { KRPC } from '~/src/krpc/krpc.ts'
import TransactionManager, { Request } from '~/src/krpc/transaction_manager.ts'
import TokenManager from '~/src/krpc/token_manager.ts'
import LocalNode from '~/src/local_node.ts'
import RoutingTable from '~/src/routing_table.ts'
import logger from '~/src/util/log.ts'
import { NetUtil } from '@deno-torrent/toolkit'

/** Bootstrap endpoint used to join the public DHT. */
export type BootstrapNode = { addr: string; port: number }

/** Configuration for one isolated DHT node. */
export type DHTOptions = {
  /** UDP port to bind and advertise. */
  port: number
  /** Local IPv4 interface to bind. Defaults to all interfaces. */
  bindAddress?: string
  /** IPv4 address advertised in compact node records. Omit to discover it through ipify. */
  publicAddress?: string
  /** Stable node ID. Omit to derive one from a network interface MAC address. */
  nodeId?: Id
  /** Bootstrap endpoints. Defaults to the public router list. */
  bootstrapNodes?: BootstrapNode[]
  /** Start bootstrap requests during construction. Defaults to true. */
  autoBootstrap?: boolean
}

/**
 * the host node of the dht network
 */
export default class DHT {
  static #DEFAULT_BOOTSTRAP_NODES = [
    {
      addr: 'router.bittorrent.com',
      port: 6881,
    },
    {
      addr: 'dht.transmissionbt.com',
      port: 6881,
    },
    {
      addr: 'router.utorrent.com',
      port: 6881,
    },
    {
      addr: 'dht.aelitis.com',
      port: 6881,
    },
  ]
  #bootstrapNodes: BootstrapNode[] // the bootstrap nodes
  #krpc: KRPC // the krpc protocol
  readonly #routingTable: RoutingTable
  readonly #infoHashManager: InfoHashManager

  private constructor(options: DHTOptions, localNode: LocalNode, bootstrapNodes: BootstrapNode[]) {
    const { port, bindAddress = '0.0.0.0', autoBootstrap = true } = options
    // check the port
    if (!NetUtil.isNetPort(port)) {
      throw new Error('invalid port, should be in range [0, 65535], but got ' + port)
    }

    // check the bootstrap nodes
    if (!bootstrapNodes || bootstrapNodes.length == 0) {
      throw new Error('you should provide at least one bootstrap node, or use the default bootstrap nodes')
    }

    logger.info('initialize isolated DHT state')
    this.#routingTable = new RoutingTable(localNode)
    this.#infoHashManager = new InfoHashManager()
    const transactionManager = new TransactionManager<Request>()
    const tokenManager = new TokenManager()

    // initilize the bootstrap nodes
    logger.info('initilize the bootstrap nodes')
    this.#bootstrapNodes = bootstrapNodes

    // initilize the krpc protocol
    logger.info('initilize the krpc protocol')
    this.#krpc = KRPC.create(
      port,
      this.#routingTable,
      this.#infoHashManager,
      transactionManager,
      tokenManager,
      bindAddress,
    )

    if (autoBootstrap) {
      void this.pingBootstrapNodes().catch((error) => logger.error(`bootstrap failed: ${error}`))
    }
  }

  /** Routing state owned exclusively by this DHT instance. */
  get routingTable(): RoutingTable {
    return this.#routingTable
  }

  /** Peer associations discovered by this DHT instance. */
  get infoHashManager(): InfoHashManager {
    return this.#infoHashManager
  }

  /**
   * create a dht network and listen on the port
   * @param port the port to listen on
   * @param bootstrapNodes the bootstrap nodes
   * @returns
   */
  static async listen(options: DHTOptions): Promise<DHT> {
    if (!options || typeof options !== 'object') throw new TypeError('DHT options are required')
    const { port, bindAddress = '0.0.0.0', publicAddress, nodeId } = options
    const bootstrapNodes = options.bootstrapNodes ?? DHT.#DEFAULT_BOOTSTRAP_NODES
    if (!NetUtil.isNetPort(port)) {
      throw new RangeError(`port must be in range [0, 65535], but got ${port}`)
    }
    if (!NetUtil.isIPv4Str(bindAddress)) throw new TypeError(`bindAddress must be an IPv4 address: ${bindAddress}`)
    if (publicAddress !== undefined && !NetUtil.isIPv4Str(publicAddress)) {
      throw new TypeError(`publicAddress must be an IPv4 address: ${publicAddress}`)
    }
    if (!bootstrapNodes || bootstrapNodes.length === 0) {
      throw new TypeError('at least one bootstrap node is required')
    }

    const localNode = await LocalNode.createLocalNode(port, { publicAddress, nodeId })

    return new DHT(options, localNode, [...bootstrapNodes])
  }

  /**
   * Contact every configured bootstrap endpoint.
   *
   * A DNS or UDP failure from one endpoint is logged and does not prevent the
   * remaining endpoints from being attempted.
   */
  async pingBootstrapNodes(): Promise<void> {
    logger.info(`start pingBootstrapNodes`)
    for (const bootstrapNode of this.#bootstrapNodes) {
      logger.info(`ping the bootstrap node ${bootstrapNode.addr}:${bootstrapNode.port}`)
      try {
        await this.#krpc.sendPingBootrapNodesRequest(bootstrapNode)
        await this.#krpc.sendFindNodeRequest(bootstrapNode.port, bootstrapNode.addr, Id.random())
      } catch (error) {
        logger.warn(`bootstrap node ${bootstrapNode.addr}:${bootstrapNode.port} failed: ${error}`)
      }
    }
  }

  /** Ask every known routing-table node for nodes near a random target. */
  async sendFindNodeRequest(): Promise<void> {
    logger.info(`start sendFindNodeRequest`)
    // get node from bucket
    for (const bucket of this.#routingTable.buckets) {
      if (bucket.isEmpty()) {
        continue
      }
      for (const node of bucket.nodes) {
        await this.#krpc.sendFindNodeRequest(node.port, node.addr, Id.random())
      }
    }
  }

  /**
   * Ask the closest known nodes for peers associated with an info hash.
   *
   * @param infoHash A 20-byte BitTorrent info hash.
   */
  async sendGetPeersRequest(infoHash: Uint8Array): Promise<void> {
    logger.info(`start sendGetPeersRequest`)
    if (this.#routingTable.nodeCount === 0) {
      logger.info(`no nodes in the routing table, skip sendGetPeersRequest`)
      return
    }
    const closestNodes = this.#routingTable.findClosestNodes(Id.fromUnit8Array(infoHash))

    if (closestNodes.length === 0) {
      logger.info(`[no closest nodes found], sendGetPeersRequest to a random node`)
      // 随机获取一个node
      const node = this.#routingTable.getRandomNode()
      if (node) {
        await this.#krpc.sendGetPeersRequest(node, infoHash)
        return
      }
    } else {
      logger.info(`[closest nodes found], sendGetPeersRequest to ${closestNodes.length} nodes`)
      for (const node of closestNodes) {
        await this.#krpc.sendGetPeersRequest(node, infoHash)
      }
    }
  }

  /**
   * Close the DHT node and release its UDP socket.
   *
   * Calling this method more than once is safe. The instance must not be used
   * to send requests after it has been closed.
   */
  close(): void {
    this.#krpc.close()
  }
}
