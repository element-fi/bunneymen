import { recoverPersonalSignature } from '@metamask/eth-sig-util'
import { Dataset, Loader, type Node } from 'bunnymen'
import type { SignedData } from './types'

export function whitelistedDataset(
  node: Node,
  addressWhitelist: string[],
  initialContentId?: string,
) {
  const whitelist = addressWhitelist.map((address) => address.toLowerCase())
  console.log('whitelist', whitelist)
  return Dataset.create<SignedData, any>(
    node,
    (current) => current?.data,
    Loader.create(),
    {
      frequency: 'static',
      validator: (data) => {
        return (
          isSignedData(data) &&
          whitelist.includes(recoverPersonalSignature(data))
        )
      },
      initialContentId,
    },
  )
}

function isSignedData(data: any): data is SignedData {
  if (
    data.hasOwnProperty('data') &&
    isHexString(data.data) &&
    data.hasOwnProperty('signature') &&
    isHexString(data.signature)
  ) {
    return true
  }
  return false
}

function isHexString(string: any) {
  return typeof string === 'string' && /^0x[a-f0-9]+$/.test(string)
}
