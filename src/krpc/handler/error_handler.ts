import { MessageHandler } from '~/src/krpc/krpc.ts'
import TransactionManager, { Request } from '~/src/krpc/transaction_manager.ts'
import { Message, MessageType } from '~/src/message_factory.ts'
import logger from '~/src/util/log.ts'
import Sender from '~/src/krpc/sender.ts'

export default class ErrorResponseHandler implements MessageHandler {
  constructor(private readonly transactionManager: TransactionManager<Request>) {}

  getHandleMessageType(): MessageType {
    return MessageType.ERROR
  }

  handle(response: Message, address: string, port: number, _client: Sender): Promise<void> {
    logger.warn(`[<======ERROR] received error response from ${address}:${port}`)

    const { e: error, t: tid } = response

    // tid 不存在或对应事务已失效（非我方发出的请求），直接忽略
    if (!tid || !this.transactionManager.isValid(tid)) {
      logger.warn(`[${tid}] received error for unknown or expired transaction from ${address}:${port}`)
      return Promise.resolve()
    }

    const request = this.transactionManager.getData(tid)
    if (!request || request.addr !== address || request.port !== port) {
      logger.warn(`[${tid}] error source ${address}:${port} does not match the original request target`)
      return Promise.resolve()
    }

    // finish transaction only after verifying the source endpoint
    this.transactionManager.finish(tid)

    if (error) {
      const [errorCode, errorMessage] = error
      logger.error(`[${tid}] received error from ${address}:${port}: ${errorCode} ${errorMessage}`)
    } else {
      logger.error(`[${tid}] received error from ${address}:${port}: unknown error`)
    }

    return Promise.resolve()
  }
}
