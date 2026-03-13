import { decode as bdecode, encode as bencode } from '@deno-torrent/bencode'
import { concat } from '@std/bytes'
import Id from '~/src/id.ts'
import Node from '~/src/node.ts'
import Peer from '~/src/peer.ts'
import RoutingTable from '~/src/routing_table.ts'
import logger from '~/src/util/log.ts'

/** KRPC 消息结构 */
export type Message = {
  /** 事务 ID，2 字节字符串 */
  t: string
  /** 消息类型：query / response / error */
  y: MessageType
  /** 查询类型，仅 query 消息携带 */
  q?: QueryType
  /** 查询参数，仅 query 消息携带 */
  a?: {
    /** 发起查询节点的 ID */
    id: Uint8Array
    /** find_node 目标节点 ID */
    target?: Uint8Array
    /** get_peers / announce_peer 的 info hash */
    info_hash?: Uint8Array
    /** announce_peer：1 表示使用发送方端口，0 使用 `port` 字段 */
    implied_port?: number
    /** announce_peer：下载端口 */
    port?: number
    /** announce_peer：令牌 */
    token?: string
  }
  /** 响应数据，仅 response 消息携带 */
  r?: {
    /** 响应节点的 ID */
    id: Uint8Array
    /** find_node / get_peers 响应：紧凑节点列表 */
    nodes?: Uint8Array
    /** get_peers 响应：紧凑 Peer 地址列表 */
    values?: Uint8Array[]
    /** get_peers 响应：令牌 */
    token?: string
  }
  /** 错误信息，仅 error 消息携带：[错误码, 错误描述] */
  e?: [number, string]
  /** DHT 协议版本标识（可选），格式为 2 字节客户端标识 + 2 字节版本 */
  v?: string
}

/**
 * KRPC 消息类型
 *
 * @see http://bittorrent.org/beps/bep_0005.html
 */
export enum MessageType {
  /** 查询消息 */
  QUERY = 'q',
  /** 响应消息 */
  RESPONSE = 'r',
  /** 错误消息 */
  ERROR = 'e',
}

/**
 * KRPC 查询类型
 */
export enum QueryType {
  /** 心跳检测 */
  PING = 'ping',
  /** 查找最近节点 */
  FIND_NODE = 'find_node',
  /** 获取持有某 info hash 的 Peer 列表 */
  GET_PEERS = 'get_peers',
  /** 宣告自己持有某 info hash */
  ANNOUNCE_PEER = 'announce_peer',
}

/**
 * KRPC 错误码
 *
 * @see http://bittorrent.org/beps/bep_0005.html#errors
 */
export enum ErrorType {
  /** 通用错误 */
  GENERIC = 201,
  /** 服务端错误 */
  SERVER = 202,
  /** 协议错误（如格式错误、非法参数、无效 token）*/
  PROTOCOL = 203,
  /** 未知方法 */
  METHOD_UNKNOWN = 204,
}

/**
 * KRPC 消息构造器
 *
 * 提供静态工厂方法生成各类 KRPC 请求 / 响应 / 错误消息，
 * 并支持 Bencode 序列化与反序列化。
 */
export default class MessageFactory {
  #message: Message

  private constructor(message: Message) {
    this.#message = message
  }

  /**
   * 将 Bencode 字节解码为消息对象
   *
   * @param data 待解码的 Bencode 字节
   * @returns 解码成功返回消息对象，格式错误返回 `undefined`
   */
  static async decode(data: Uint8Array): Promise<Message | undefined> {
    try {
      const message = (await bdecode(data)) as Message

      if (!message || !message.y || !message.t) return undefined

      return message
    } catch (e) {
      logger.error(`[Bencode] decode message error: ${e}`)
      return undefined
    }
  }

  /**
   * 将当前消息编码为 Bencode 字节
   *
   * @returns Bencode 编码的字节数组
   */
  async bencode(): Promise<Uint8Array> {
    return await bencode(this.#message)
  }

  /**
   * 返回原始消息对象
   */
  message(): Message {
    return this.#message
  }

  /**
   * 构造 ping 查询消息
   *
   * @param tid    事务 ID
   * @param nodeId 本地节点 ID
   */
  static requestPing(tid: string, nodeId: Id): MessageFactory {
    return new MessageFactory({
      t: tid,
      y: MessageType.QUERY,
      q: QueryType.PING,
      a: { id: nodeId.bits.bytes },
    })
  }

  /**
   * 构造 find_node 查询消息
   *
   * @param tid      事务 ID
   * @param nodeId   本地节点 ID
   * @param targetId 目标节点 ID
   */
  static requestFindNode(tid: string, nodeId: Id, targetId: Id): MessageFactory {
    return new MessageFactory({
      t: tid,
      y: MessageType.QUERY,
      q: QueryType.FIND_NODE,
      a: {
        id: nodeId.bits.bytes,
        target: targetId.bits.bytes,
      },
    })
  }

  /**
   * 构造 get_peers 查询消息
   *
   * @param tid      事务 ID
   * @param nodeId   本地节点 ID
   * @param infoHash 目标 info hash（20 字节）
   */
  static requestGetPeers(tid: string, nodeId: Id, infoHash: Uint8Array): MessageFactory {
    return new MessageFactory({
      t: tid,
      y: MessageType.QUERY,
      q: QueryType.GET_PEERS,
      a: {
        id: nodeId.bits.bytes,
        info_hash: infoHash,
      },
    })
  }

  /**
   * 构造 announce_peer 查询消息
   *
   * @param tid      事务 ID
   * @param nodeId   本地节点 ID
   * @param infoHash 目标 info hash（20 字节）
   * @param port     本地下载端口
   */
  static requestAnnouncePeer(
    tid: string,
    nodeId: Id,
    infoHash: Uint8Array,
    port: number,
    token: string,
  ): MessageFactory {
    return new MessageFactory({
      t: tid,
      y: MessageType.QUERY,
      q: QueryType.ANNOUNCE_PEER,
      a: {
        id: nodeId.bits.bytes,
        implied_port: 0,
        info_hash: infoHash,
        port,
        token,
      },
    })
  }

  /**
   * 构造 ping 响应消息
   *
   * @param tid 事务 ID
   */
  static responsePing(tid: string): MessageFactory {
    return new MessageFactory({
      t: tid,
      y: MessageType.RESPONSE,
      r: { id: RoutingTable.get().localNode.id.bits.bytes },
    })
  }

  /**
   * 构造 find_node 响应消息
   *
   * @param tid   事务 ID
   * @param nodes 最近节点列表（将被序列化为紧凑格式）
   */
  static responseFindNode(tid: string, nodes: Node[]): MessageFactory {
    const compactNodeList = nodes.map((node) => node.toCompact())

    return new MessageFactory({
      t: tid,
      y: MessageType.RESPONSE,
      r: {
        id: RoutingTable.get().localNode.id.bits.bytes,
        // @std/bytes v1.x：concat 接受 Uint8Array[] 数组而非展开参数
        nodes: concat(compactNodeList),
      },
    })
  }

  /**
   * 构造 get_peers 响应消息
   *
   * 当存在 Peer 时返回 `values`；否则返回 `nodes`（最近节点）。
   * `peers` 和 `nodes` 至少须提供其一。
   *
   * @param tid   事务 ID
   * @param peers Peer 列表（可选）
   * @param nodes 最近节点列表（可选）
   * @param token 令牌（可选）
   */
  static responseGetPeers(tid: string, peers?: Peer[], nodes?: Node[], token?: string): MessageFactory {
    const hasPeers = peers && peers.length > 0
    const hasNodes = nodes && nodes.length > 0

    if (!hasPeers && !hasNodes) {
      throw new Error('must provide peers or nodes')
    }

    if (hasNodes) {
      const compactNodeList = nodes!.map((node) => node.toCompact())

      return new MessageFactory({
        t: tid,
        y: MessageType.RESPONSE,
        r: {
          id: RoutingTable.get().localNode.id.bits.bytes,
          nodes: concat(compactNodeList),
        },
      })
    } else {
      return new MessageFactory({
        t: tid,
        y: MessageType.RESPONSE,
        r: {
          id: RoutingTable.get().localNode.id.bits.bytes,
          token,
          values: peers!.map((peer) => peer.toCompact()),
        },
      })
    }
  }

  /**
   * 构造 announce_peer 响应消息
   *
   * @param tid 事务 ID
   */
  static responseAnnouncePeer(tid: string): MessageFactory {
    return new MessageFactory({
      t: tid,
      y: MessageType.RESPONSE,
      r: { id: RoutingTable.get().localNode.id.bits.bytes },
    })
  }

  /**
   * 构造错误消息
   *
   * @param tid          事务 ID
   * @param errorCode    错误码
   * @param errorMessage 错误描述（可选）
   */
  static responseError(tid: string, errorCode: ErrorType, errorMessage?: string): MessageFactory {
    return new MessageFactory({
      t: tid,
      y: MessageType.ERROR,
      e: [errorCode.valueOf(), errorMessage ?? ''],
    })
  }
}
