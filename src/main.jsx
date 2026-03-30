import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

const root = createRoot(document.getElementById('root'))

const ZOHO = window.ZOHO

if (ZOHO) {
  console.log('[main] ZOHO SDK found, registering PageLoad listener...')

  ZOHO.embeddedApp.on('PageLoad', (data) => {
    console.log('[main] PageLoad event received:', data)
    root.render(<App pageData={data} />)
  })

  ZOHO.embeddedApp.init().then(() => {
    console.log('[main] ZOHO embeddedApp initialized successfully')
  }).catch((err) => {
    console.error('[main] ZOHO embeddedApp init failed:', err)
  })
} else {
  console.warn('[main] ZOHO SDK not found — rendering in dev mode')
  root.render(<App pageData={{ EntityId: ['DEV_VENDOR_ID'], Entity: 'Vendors' }} />)
}
