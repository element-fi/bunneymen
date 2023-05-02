<script lang="ts">
  import { onMount } from 'svelte'
  import { BunnymenDB, Node } from 'bunnymen'
  import detectEthereumProvider from '@metamask/detect-provider'
  import { sigDataset } from './lib/sigDataset'
  import { whitelistedDataset } from './lib/whitelistedDataset'
  import { signedDataTransformer } from './lib/signedDataTransformer'

  let provider
  let accounts: string[] = []
  let topicProvider = ''
  let data = ''
  let newData = ''

  const specialTopic = 'something-special'
  const specialNode = new Node(specialTopic)
  const db = new BunnymenDB()

  // re-register the sig dataset when the accounts change
  $: {
    const topicProviderDataset = sigDataset(specialNode, accounts[0], provider)
    db.registerDatasets('provider', topicProviderDataset)
    const specialDataset = whitelistedDataset(specialNode, [topicProvider])
    db.registerDatasets(specialTopic, specialDataset)
    db.registerTransformer(specialTopic, signedDataTransformer)
    db.init()
  }

  function handleSet() {
    db.set('provider', newData)
  }

  onMount(async () => {
    provider = await detectEthereumProvider()
    accounts = await provider.request({ method: 'eth_accounts' })
    provider.on('accountsChanged', (newAccounts) => (accounts = newAccounts))

    db.subscribe(specialTopic, (data) => {
      data = JSON.stringify(data, null, 2)
    })
  })
</script>

<main class="flex flex-col gap-4 max-w-md mx-auto">
  <div class="daisy-input-group-vertical">
    <label for="provider" class="daisy-label">Provider address:</label>
    <input
      id="provider"
      class="border border-primary daisy-input w-full"
      placeholder="0x..."
      bind:value={topicProvider}
    />
  </div>

  <div class="daisy-input-group-vertical">
    <label for="input" class="daisy-label">New Data</label>
    <textarea
      id="input"
      class="daisy-textarea border-primary border w-full"
      bind:value={newData}
    />
  </div>

  <div class="daisy-btn-group-horizontal">
    <button class="daisy-btn" on:click={handleSet}>
      Set provider dataset
    </button>
  </div>

  <div class="daisy-input-group-vertical">
    <label for="current" class="daisy-label">Current sandbox data:</label>
    <textarea
      id="current"
      class="daisy-textarea border-primary border w-full"
      bind:value={data}
      readonly
    />
  </div>
</main>
