import Id from '~/src/id.ts'
import Peer from '~/src/peer.ts'
import { extractCompactNode, packageCompactNode } from '~/src/util/net.ts'

/**
 * Node must be a Peer, and it contains the node's id, routing table and file info hashs
 */
export default class Node extends Peer {
  readonly ACTIVE_RANGE = 5 * 60 * 1000 // 5 minutes
  #id: Id // 20 bytes sha1 hash
  #activedAt!: number // the last active time of the node

  constructor(id: Id, port: number, addr: string) {
    super(port, addr)
    this.#id = id
    this.#activedAt = Date.now()
  }

  updateActivedAt() {
    this.#activedAt = Date.now()
  }

  get activedAt(): number {
    return this.#activedAt
  }

  isActive(): boolean {
    return Date.now() - this.#activedAt < this.ACTIVE_RANGE
  }

  get id(): Id {
    return this.#id
  }

  override update(port: number, addr: string): void {
    super.update(port, addr)
    this.updateActivedAt()
  }

  override toString(): string {
    return `{id: ${this.#id.toString()}, port: ${this.port}, addr: ${this.addr}}`
  }

  override toCompact(): Uint8Array {
    return packageCompactNode(this.#id, this.addr, this.port)
  }

  static override fromCompact(bytes: Uint8Array): Node {
    const { id, port, addr } = extractCompactNode(bytes)

    return new Node(id, port, addr)
  }
}
