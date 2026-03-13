/**
 * 测试公共夹具
 *
 * 提供 MockSender（捕获所有出站调用）和常用辅助工厂函数，
 * 避免在各 handler 测试文件中重复定义。
 */
import Id from '../src/id.ts'
import LocalNode from '../src/local_node.ts'
import Sender from '../src/krpc/sender.ts'
import MessageFactory from '../src/message_factory.ts'
import Node from '../src/node.ts'
import { sha1 } from '../src/util/hash.ts'

// ─── MockSender ──────────────────────────────────────────────────────────────

/** sendMessage 调用的捕获记录 */
export type SentMessage = { port: number; addr: string; factory: MessageFactory }

/**
 * MockSender 实现 Sender 接口，将所有出站调用记录到内存列表，
 * 不产生任何真实网络 I/O。
 */
export class MockSender implements Sender {
  readonly sentMessages: SentMessage[] = []
  readonly sentGetPeers: Array<{ node: Node; infoHash: Uint8Array }> = []

  async sendMessage(port: number, addr: string, factory: MessageFactory): Promise<void> {
    this.sentMessages.push({ port, addr, factory })
  }

  async sendPingRequest(_node: Node): Promise<void> {}

  async sendFindNodeRequest(_port: number, _addr: string, _targetId: Id): Promise<void> {}

  async sendGetPeersRequest(node: Node, infoHash: Uint8Array): Promise<void> {
    this.sentGetPeers.push({ node, infoHash })
  }

  async sendAnnouncePeerRequest(_node: Node, _infoHash: Uint8Array, _token: string): Promise<void> {}

  /** 快捷方法：取第 n 条 sendMessage 记录的解码 Message */
  getMessageAt(index: number) {
    return this.sentMessages[index]?.factory.message()
  }
}

// ─── 辅助工厂 ────────────────────────────────────────────────────────────────

/**
 * 用 label 字符串生成确定性 ID，创建 LocalNode。
 * 用于各测试文件独立初始化 RoutingTable 单例。
 */
export function makeLocalNode(label: string, port = 16000, addr = '127.0.0.1'): LocalNode {
  const id = Id.fromUnit8Array(sha1(new TextEncoder().encode(label)))
  return new LocalNode(id, port, addr)
}

/**
 * 用 label 字符串生成确定性 ID，创建普通 Node。
 */
export function makeNode(label: string, addr = '10.0.0.1', port = 6881): Node {
  const id = Id.fromUnit8Array(sha1(new TextEncoder().encode(label)))
  return new Node(id, port, addr)
}

/**
 * 用 label 字符串生成确定性的 20 字节 SHA-1，作为 info hash 使用。
 */
export function makeInfoHash(label: string): Uint8Array {
  return sha1(new TextEncoder().encode(label))
}
