export interface SignedData {
  data: string
  signature: string
}

export interface MinimumProvider {
  request: (options: { method: string; params: any[] }) => Promise<string>
}
