import { EventEmitter } from 'events'
import { Cache } from './cache'
import { ILoader } from './loader.js'
import { Node } from './node.js'
import type { IPayload } from './types.js'

export type Fetcher<TData = any, TRawData = TData> = (
  currentData?: TData,
) => TRawData | Promise<TRawData>

export type Validator = (receivedData: any) => boolean | Promise<boolean>

// 'static' = never stale
export type Frequency = number | 'static'

export interface IDatasetEvents<TData = any> {
  updated: (payload: IPayload<TData>) => void
}

export interface IDatasetOptions<TData = any, TRawData = TData> {
  initializer?: Fetcher<undefined, TRawData>
  initialContentId?: string
  /**
   * Number of ms until the data is considered stale. Set to `"static"` to
   * prevent the data from ever going stale.
   */
  frequency?: Frequency
  /**
   * Used to decide if data from a peer is valid and should be accepted.
   */
  validator?: Validator
  cache?: Cache<IPayload<TData>>
}

export interface IDataset<TData = any, TRawData = TData> extends EventEmitter {
  init: () => Promise<void>
  get: () => Promise<IPayload<TData>>
  set: (newData: TRawData) => Promise<IPayload<TData>>
  on: <K extends keyof IDatasetEvents<TData>>(
    event: K,
    listener: IDatasetEvents<TData>[K],
  ) => this
  emit: <K extends keyof IDatasetEvents<TData>>(
    event: K,
    ...args: Parameters<IDatasetEvents<TData>[K]>
  ) => boolean
  get peerId(): string
  get peers(): string[]
}

export class Dataset<TData = any, TRawData = TData>
  extends EventEmitter
  implements IDataset<TData, TRawData>
{
  private node: Node
  private initializer: Fetcher<undefined, TRawData>
  private fetcher: Fetcher<TData, TRawData>
  private validator: Validator
  private loader: ILoader<TData, TRawData>
  private currentCID?: string
  private topic: string = ''
  private cache: Cache<IPayload<TData>>
  private untypedOn = this.on
  private untypedEmit = this.emit
  public override on = <K extends keyof IDatasetEvents<TData>>(
    event: K,
    listener: IDatasetEvents<TData>[K],
  ): this => this.untypedOn(event, listener)
  public override emit = <K extends keyof IDatasetEvents<TData>>(
    event: K,
    ...args: Parameters<IDatasetEvents<TData>[K]>
  ): boolean => this.untypedEmit(event, ...args)

  get peerId() {
    return this.node.peerId
  }
  get peers() {
    return this.node.getPeers(this.topic)
  }

  // ms
  frequency: Frequency

  // unix timestamp
  lastUpdated = 0

  /**
   * The constructor is private to enforce the use of the factory method
   * `create`, which will ensure that the generic types are correctly inferred.
   */
  private constructor(
    node: Node,
    fetcher: Fetcher,
    loader: ILoader,
    options?: IDatasetOptions<TData, TRawData>,
  ) {
    super()
    const {
      initializer,
      initialContentId,
      frequency = 'static',
      validator = () => true,
      cache = new Cache(),
    } = options || {}

    this.node = node
    this.initializer = initializer ?? fetcher
    this.fetcher = fetcher
    this.validator = validator
    this.loader = loader
    this.currentCID = initialContentId
    this.cache = cache
    this.frequency = frequency
  }

  /**
   * Factory method with strong typing.
   */
  static create<TData = any, TRawData = TData>(
    node: Node,
    fetcher: Fetcher<TData, TRawData>,
    loader: ILoader<TData, TRawData>,
    options?: IDatasetOptions<TData, TRawData>,
  ): Dataset<TData, TRawData> {
    return new Dataset(node, fetcher, loader, options)
  }

  private update(payload: IPayload<TData>, cid: string) {
    this.currentCID = cid
    this.cache.set(payload)
    this.lastUpdated = payload.lastUpdated
    this.emit('updated', payload)
  }

  private async fetchWith(fetcher: Fetcher, currentData?: TData) {
    const data = await fetcher(currentData)
    const { cid, payload } = await this.loader.load(
      this.node,
      this.topic,
      data,
      this.currentCID,
    )
    this.update(payload, cid)
    return payload
  }

  private isStale() {
    if (this.frequency === 'static') {
      return false
    }

    // Using `>=` since "frequency" feels like "update every n milliseconds",
    // whereas `>` would fit better for "keep alive for n milliseconds"
    return Date.now() - this.lastUpdated >= this.frequency
  }

  /**
   * Does the following:
   * - Subscribe to the node
   * - Listen for new peers and send them the current payload if this node is
   *   the leader
   * - listen for new payloads and update the current one if the received one is
   *   newer
   * - If the received payload is older than the current one, then try to merge
   *   its data with the current data. If this results in a new payload,
   *   propagate to peers.
   */
  async init() {
    // download payloads after a peer sends a new CID
    this.node.on('receivedMessage', async (receivedCID) => {
      if (receivedCID === this.currentCID || receivedCID.length !== 46) {
        return
      }
      const receivedPayload = await this.loader.download(
        this.node,
        this.topic,
        receivedCID,
      )
      const isValid = await this.validator(receivedPayload.data)
      if (!isValid) {
        return
      }
      if (receivedPayload.lastUpdated > this.lastUpdated) {
        this.update(receivedPayload, receivedCID)
      } else {
        const { payload, cid } = await this.loader.loadHistorical(
          this.node,
          this.topic,
          receivedPayload.data,
          this.currentCID as string,
        )
        this.update(payload, cid)
      }
    })

    this.node.on('peerSubscribed', (peerId) => {
      // only if there is a cid to send
      if (!!this.currentCID && this.node.isLeader(this.topic)) {
        // send latest cid when we see that a node has joined the channel
        this.node.sendMessage(this.topic, this.currentCID)
      } else {
        console.log(
          'DATASET: no data has been uploaded yet so there is no message to send',
        )
      }
      console.log('DATASET: peer subscribed ' + peerId)
    })

    // listen for messages (new CIDs)
    await this.node.subscribe(this.topic)
  }

  async get() {
    if (!this.currentCID) {
      return this.fetchWith(this.initializer)
    }
    const cachedPayload = this.cache.get()
    if (!cachedPayload) {
      return this.loader.download(this.node, this.topic, this.currentCID)
    }
    if (this.isStale()) {
      return this.fetchWith(this.fetcher, cachedPayload?.data)
    }
    return cachedPayload
  }

  async set(newData: TRawData) {
    const { cid, payload } = await this.loader.load(
      this.node,
      this.topic,
      newData,
      this.currentCID,
    )
    this.update(payload, cid)
    return payload
  }
}
