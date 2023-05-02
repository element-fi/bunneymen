import type { IPayload } from 'bunnymen'
import type { SignedData } from './types'

export function hexToString(hex: string) {
  return hex
    .slice(2) // remove the "0x" prefix
    .match(/.{2}/g) // create an array from every 2 characters
    .map((hex) => +`0x${hex}`) // turn into base-10 char codes
    .map((charCode) => String.fromCharCode(charCode)) // turn into decoded characters
    .join('') // join into a full string
}

export function signedDataTransformer([payload]: [IPayload<SignedData>]) {
  const decodedJSON = hexToString(payload.data.data)
  return JSON.parse(decodedJSON)
}
