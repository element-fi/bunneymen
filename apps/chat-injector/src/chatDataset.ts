import { Dataset, Loader, Node } from 'bunnymen'

export interface IMessageData {
  user: string
  content: string
  /**
   * unix timestamp of when the message was sent
   */
  timestamp: number
}

/**
 * A Dataset for storing chat history
 */
export function chatDataset(node: Node, maxHistory = 50) {
  return Dataset.create<IMessageData[], string[]>(
    node,
    () => [],
    // A loader that turns an array of strings into an array of `IMessageData`s
    // and appends them to a list with a max size of `maxHistory`
    Loader.create({
      // map over new messages coming in and turn them into `IMessageData`s
      transformer: (newMessages) => {
        return newMessages.map((message) => {
          return {
            user: node.peerId,
            content: message,
            timestamp: Date.now(),
          }
        })
      },

      // Merge new messages with existing data and keep the last `maxHistory`
      aggregator: (messageHistory, newMessages) => {
        console.log('messageHistory', messageHistory)
        return (messageHistory || []).concat(newMessages).slice(-maxHistory)
      },
    }),
  )
}
