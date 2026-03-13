import Id from '~/src/id.ts'
import InfoHashManager from '~/src/info_hash_manager.ts'
import { MessageHandler } from '~/src/krpc/krpc.ts'
import Sender from '~/src/krpc/sender.ts'
import MessageFactory, { ErrorType, Message, MessageType, QueryType } from '~/src/message_factory.ts'
import Node from '~/src/node.ts'
import Peer from '~/src/peer.ts'
import RoutingTable from '~/src/routing_table.ts'
import logger from '~/src/util/log.ts'
import { BytesUtil } from '@deno-torrent/toolkit'

export default class RequestHandler implements MessageHandler {
  getHandleMessageType(): MessageType {
    return MessageType.QUERY
  }

  async handle(reqMsg: Message, addr: string, port: number, sender: Sender): Promise<void> {
    const { t: tid, a: data, q: type } = reqMsg

    const reqNodeId = data?.id as Uint8Array

    if (!Id.isValidId(reqNodeId)) {
      logger.warn(`invalid node id: ${reqNodeId}, which from ${addr}:${port}]`)

      await sender.sendMessage(port, addr, MessageFactory.responseError(tid, ErrorType.PROTOCOL, 'invalid node id'))
      return
    }

    const reqNode = new Node(Id.fromUnit8Array(reqNodeId), port, addr)

    switch (type) {
      case QueryType.PING:
        await this.handlePingQueryRequest(reqMsg, reqNode, tid, sender)
        break
      case QueryType.FIND_NODE:
        await this.handleFindNodeQueryRequest(reqMsg, reqNode, tid, sender)
        break
      case QueryType.GET_PEERS:
        await this.handleGetPeersQueryRequest(reqMsg, reqNode, tid, sender)
        break
      case QueryType.ANNOUNCE_PEER:
        await this.handleAnnouncePeerQueryRequest(reqMsg, reqNode, tid, sender)
        break
      default:
        logger.error(`unknown query type: ${type}`)
    }
  }

  // handle the ping query request from other node
  async handlePingQueryRequest(reqMsg: Message, reqNode: Node, tid: string, sender: Sender) {
    logger.info(`[<======QUERY-PING-${reqMsg.q}] received from ${reqNode.addr}:${reqNode.port}`)

    // return local node id
    const response = MessageFactory.responsePing(tid)

    await sender.sendMessage(reqNode.port, reqNode.addr, response)
  }

  async handleFindNodeQueryRequest(reqMsg: Message, reqNode: Node, tid: string, sender: Sender) {
    logger.info(`[<======QUERY-FIND_NODE-${reqMsg.q}] received from ${reqNode.addr}:${reqNode.port}`)

    // find closest nodes from k-buckets by request target node id
    const targetIdBytes = reqMsg.a?.target

    if (!targetIdBytes) {
      logger.error(`[${tid}]: invalid target id: ${targetIdBytes}`)
      await sender.sendMessage(
        reqNode.port,
        reqNode.addr,
        MessageFactory.responseError(tid, ErrorType.PROTOCOL, `invalid target id: ${targetIdBytes}`),
      )
      return
    }

    if (!Id.isValidId(targetIdBytes)) {
      logger.error(`[${tid}]: invalid target id: ${targetIdBytes}`)
      await sender.sendMessage(
        reqNode.port,
        reqNode.addr,
        MessageFactory.responseError(tid, ErrorType.PROTOCOL, `invalid target id: ${targetIdBytes}`),
      )
      return
    }

    const targetId = Id.fromUnit8Array(targetIdBytes)

    const closestNodes = RoutingTable.get().findClosestNodes(targetId, 8)

    if (!closestNodes || closestNodes.length === 0) {
      logger.error(`[${tid}]: not found closest nodes for target id: ${targetId}`)
      await sender.sendMessage(
        reqNode.port,
        reqNode.addr,
        MessageFactory.responseError(tid, ErrorType.GENERIC, `not found closest nodes for target id: ${targetId}`),
      )
      return
    } else {
      logger.info(`[${tid}]: find ${closestNodes.length} closest nodes for target id: ${targetId}`)
    }

    // response to request node
    await sender.sendMessage(reqNode.port, reqNode.addr, MessageFactory.responseFindNode(tid, closestNodes))
  }

  async handleGetPeersQueryRequest(reqMsg: Message, reqNode: Node, tid: string, sender: Sender) {
    logger.info(`[<======QUERY-GET_PEERS-${reqMsg.q}] received from ${reqNode.addr}:${reqNode.port}`)

    const infoHash = reqMsg.a?.info_hash as Uint8Array
    const infoHashHex = BytesUtil.bytes2HexStr(infoHash)
    const peers = InfoHashManager.get().find(infoHashHex)
    const token = InfoHashManager.get().findToken(infoHashHex)

    let response: MessageFactory
    if (peers && peers.length > 0) {
      logger.info(`[${tid}]: find ${peers.length} peers for info hash: ${infoHashHex}}`)
      // return peers
      response = MessageFactory.responseGetPeers(tid, peers, undefined, token)
    } else {
      const closestNodes = RoutingTable.get().findClosestNodes(Id.fromUnit8Array(infoHash), 8)

      if (closestNodes && closestNodes.length > 0) {
        logger.info(`[${tid}]: find ${closestNodes.length} nodes for info hash: ${infoHashHex}}`)
        // return closest nodes
        response = MessageFactory.responseGetPeers(tid, undefined, closestNodes, undefined)
      } else {
        logger.error(`[${tid}]: can not find peers or nodes for info hash: ${infoHashHex}}`)
        response = MessageFactory.responseError(
          tid,
          ErrorType.GENERIC,
          `can not find nodes for target id: can not find peers or nodes for info hash: ${infoHashHex}}`,
        )
      }
    }

    // response to the request node
    await sender.sendMessage(reqNode.port, reqNode.addr, response)
  }

  async handleAnnouncePeerQueryRequest(reqMsg: Message, reqNode: Node, tid: string, sender: Sender) {
    logger.info(`[<======QUERY-ANNOUNCE_PEER-${reqMsg.q}] received from ${reqNode.addr}:${reqNode.port}`)

    const infoHash = reqMsg.a?.info_hash as Uint8Array
    const port = reqMsg.a?.port as number // reqNode download port for bittorrent
    const token = reqMsg.a?.token as string // token of the info hash (from a prior get_peers response)

    if (!Id.isValidId(infoHash)) {
      logger.error(`[${tid}]: invalid info hash: ${infoHash}`)
      await sender.sendMessage(
        reqNode.port,
        reqNode.addr,
        MessageFactory.responseError(tid, ErrorType.PROTOCOL, 'invalid info hash'),
      )
      return
    }

    if (!port) {
      logger.error(`[${tid}]: invalid port: ${port}`)
      await sender.sendMessage(
        reqNode.port,
        reqNode.addr,
        MessageFactory.responseError(tid, ErrorType.PROTOCOL, 'invalid port'),
      )
      return
    }

    if (!token) {
      logger.error(`[${tid}]: invalid token: ${token}`)

      await sender.sendMessage(
        reqNode.port,
        reqNode.addr,
        MessageFactory.responseError(tid, ErrorType.PROTOCOL, 'invalid token'),
      )

      return
    }

    // 0 or 1, 1 means use the sender port, ignore the port in the request. 0 means use the port in the request as the download port
    // if the node is behind a NAT, the sender port is the public port, the download port is the private port, at this time, the implied_port should be 1
    const impliedPort = (reqMsg.a?.implied_port as number) || 0

    // validate the token of the info hash
    const tokenOfInfoHash = InfoHashManager.get().findToken(BytesUtil.bytes2HexStr(infoHash))

    if (tokenOfInfoHash && tokenOfInfoHash !== token) {
      logger.error(`[${tid}]: invalid token: ${token}`)

      await sender.sendMessage(
        reqNode.port,
        reqNode.addr,
        MessageFactory.responseError(tid, ErrorType.PROTOCOL, 'token not match'),
      )
      return
    }

    const infoHashHex = BytesUtil.bytes2HexStr(infoHash)

    const downloadPort = impliedPort === 1 ? reqNode.port : port

    // store the peer
    InfoHashManager.get().add(infoHashHex, new Peer(downloadPort, reqNode.addr), token)

    // response to the request node
    await sender.sendMessage(reqNode.port, reqNode.addr, MessageFactory.responseAnnouncePeer(tid))
  }
}
