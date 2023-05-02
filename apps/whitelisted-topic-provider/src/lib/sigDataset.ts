import { Dataset, Loader, Node } from 'bunnymen'
import stringify from 'fast-json-stable-stringify'
import type { MinimumProvider, SignedData } from './types'

export function sigDataset(
  node: Node,
  account: string,
  provider: MinimumProvider,
) {
  return Dataset.create<SignedData, any>(
    node,
    (currentPayload) => currentPayload?.data,
    Loader.create({
      transformer: async (data) => {
        if (typeof data === undefined) {
          throw 'No data. There must be something to sign.'
        }

        if (!account || !provider) {
          throw 'No account found. Connect your wallet to sign the data.'
        }

        const encodedData = new TextEncoder().encode(stringify(data))
        const hexData = `0x${[...encodedData]
          .map((byte) => byte.toString(16))
          .join('')}`

        return {
          data: hexData,
          signature: await provider.request({
            method: 'eth_sign',
            params: [account, hexData],
          }),
        }
      },
    }),
  )
}
