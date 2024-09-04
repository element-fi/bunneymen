import { EventEmitter } from 'events'
import { IDataset } from './dataset.js'
import { Transformer } from './types.js'

export interface IBunnymenDB {
  registerDatasets: (key: string, ...dataSets: IDataset[]) => boolean
  registerTransformer: (key: string, transformer: Transformer) => boolean
  init: () => void
  get: <TData extends any = any>(key: string) => Promise<TData>
  set: (key: string, data: any) => Promise<void>
  subscribe: (key: string, handler: (data: any) => void) => void
}

export interface IBunnymenEvents {
  /**
   * Fired when init is complete.
   */
  ready: () => void
}

export class BunnymenDB extends EventEmitter implements IBunnymenDB {
  private datasets: Record<string, IDataset[]> = {}
  private transformers: Record<string | never, Transformer> = {}
  private untypedOn = this.on
  private untypedEmit = this.emit
  public override on = <K extends keyof IBunnymenEvents>(
    event: K,
    listener: IBunnymenEvents[K],
  ): this => this.untypedOn(event, listener)
  public override emit = <K extends keyof IBunnymenEvents>(
    event: K,
    ...args: Parameters<IBunnymenEvents[K]>
  ): boolean => this.untypedEmit(event, ...args)

  get peers() {
    const flattened = ([] as IDataset[]).concat(...Object.values(this.datasets))
    return ([] as string[]).concat(...flattened.map((dataset) => dataset.peers))
  }

  constructor() {
    super()
  }

  // TODO: Remove ambiguity between setting and appending
  registerDatasets(key: string, ...datasets: IDataset[]) {
    this.datasets[key] = datasets
    return true
  }

  // TODO: Multiple transformers for a single key
  registerTransformer(key: string, transformer: Transformer) {
    this.transformers[key] = transformer
    return true
  }

  async init(): Promise<void> {
    const datasetArrays = Object.values(this.datasets)
    const allDatasets = ([] as IDataset[]).concat(...datasetArrays)
    await Promise.all(allDatasets.map((dataset) => dataset.init()))
    this.emit('ready')
  }

  // TODO: how to add strong types to key arg and return value
  async get(key: string) {
    const datasets = this.datasets[key]
    if (!datasets) {
      return null
    }

    const rawDatas = []
    for (const dataset of datasets) {
      const rawData = await dataset.get()
      rawDatas.push(rawData)
    }

    const transformer = this.transformers[key]
    if (transformer) {
      return await transformer(...rawDatas)
    }

    if (rawDatas.length === 1) {
      return rawDatas[0]
    }

    return rawDatas
  }

  /**
   * This calls `set()` on every dataset registered for the key. To only update
   * a single one, call `set()` on the dataset directly.
   */
  // TODO: Remove ambiguity between keys representing a single dataset and multiple datasets
  async set(key: string, data: any) {
    const datasets = this.datasets[key]
    if (datasets) {
      for (const dataset of datasets) {
        await dataset.set(data)
      }
    }
  }

  subscribe(key: string, handler: (data: any) => void) {
    const datasets = this.datasets[key]

    // TODO: what happens if a dataset is registered after I've already
    // subscribed?
    // We could track the key => handler mapping and check it when registering
    if (!datasets) {
      return
    }

    for (const dataset of datasets) {
      dataset.on('updated', async () => {
        handler(await this.get(key))
      })
    }
  }
}
