import { MessageHandler } from '~/src/krpc/krpc.ts'
import TransactionManager from '~/src/krpc/transaction_manager.ts'
import { Message, MessageType } from '~/src/message_factory.ts'
import logger from '~/src/util/log.ts'
import Sender from '~/src/krpc/sender.ts'

export default class ErrorResponseHandler implements MessageHandler {
  getHandleMessageType(): MessageType {
    return MessageType.ERROR
  }

  handle(response: Message, address: string, port: number, _client: Sender): Promise<void> {
    logger.warn(`[<======ERROR] received invalid error from ${address}:${port}`)

    const { e: error, t: tid } = response

    // tid 不存在或对应事务已失效（非我方发出的请求），直接忽略
    if (!tid || !TransactionManager.get().isValid(tid)) {
      logger.warn(`[${tid}] received error for unknown or expired transaction from ${address}:${port}`)
      return Promise.resolve()
    }

    // finish transaction
    TransactionManager.get().finish(tid)

    if (error) {
      const [errorCode, errorMessage] = error
      logger.error(`[${tid}] received error from ${address}:${port}: ${errorCode} ${errorMessage}`)
    } else {
      logger.error(`[${tid}] received error from ${address}:${port}: unknown error`)
    }

    return Promise.resolve()
  }
}
