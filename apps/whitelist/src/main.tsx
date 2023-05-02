import React from 'react'
import ReactDOM from 'react-dom/client'
import { WagmiConfig } from 'wagmi'
import App from './App'
import { wagmiClient } from './clients/wagmi'
import './index.css'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <WagmiConfig client={wagmiClient}>
    <React.StrictMode>
      <App />
    </React.StrictMode>
  </WagmiConfig>,
)
