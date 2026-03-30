import { useEffect, useState } from 'react'
import { getVendorRecord, resizeWidget, fetchItems, fetchTaxes, fetchNextPONumber, createBooksPurchaseOrder, createCRMPurchaseOrder } from './services/zohoService'
import PurchaseOrderForm from './components/PurchaseOrderForm'

function App({ pageData }) {
  const isDevMode = !pageData?.EntityId?.[0] || pageData?.EntityId?.[0] === 'DEV_VENDOR_ID'
  const [vendor, setVendor] = useState(isDevMode ? { Vendor_Name: 'Dev Mode Vendor', Books_Contact_ID: 'DEV_123' } : null)
  const [loading, setLoading] = useState(!isDevMode)
  const [error, setError] = useState(null)
  const [items, setItems] = useState([])
  const [taxes, setTaxes] = useState([])
  const [poNumber, setPoNumber] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitResult, setSubmitResult] = useState(null)

  useEffect(() => {
    console.log('[App] Mounted with pageData:', pageData)

    resizeWidget(1200, 700)

    const vendorId = pageData?.EntityId?.[0] || pageData?.EntityId
    console.log('[App] Vendor ID from pageData:', vendorId)

    if (!vendorId || vendorId === 'DEV_VENDOR_ID') {
      console.log('[App] Dev mode — skipping API call')
      return
    }

    Promise.all([
      getVendorRecord(vendorId),
      fetchItems(),
      fetchTaxes(),
      fetchNextPONumber(),
    ])
      .then(([vendorData, itemsData, taxesData, nextPO]) => {
        console.log('[App] Vendor data loaded:', vendorData)
        console.log('[App] Items loaded:', itemsData)
        console.log('[App] Taxes loaded:', taxesData)
        console.log('[App] Next PO number:', nextPO)

        if (vendorData) {
          setVendor(vendorData)
        } else {
          setError('Vendor not found')
        }
        setItems(itemsData)
        setTaxes(taxesData)
        if (nextPO) setPoNumber(nextPO)
      })
      .catch((err) => {
        console.error('[App] Error loading data:', err)
        setError('Failed to load data')
      })
      .finally(() => setLoading(false))
  }, [pageData])

  // Get CRM Vendor ID from pageData
  const crmVendorId = pageData?.EntityId?.[0] || pageData?.EntityId

  const savePO = async (payload, status) => {
    setSubmitting(true)
    setSubmitResult(null)

    // Step 1: Create PO in Zoho Books
    const booksResult = await createBooksPurchaseOrder(payload, status)
    console.log('[App] Books result:', booksResult)

    if (!booksResult.success) {
      setSubmitting(false)
      setSubmitResult({ type: 'error', message: `Books: ${booksResult.error}` })
      return
    }

    // Step 2: Create PO in CRM + link to Vendor
    const crmResult = await createCRMPurchaseOrder(booksResult.purchaseorder, crmVendorId, payload)
    console.log('[App] CRM result:', crmResult)

    setSubmitting(false)

    if (crmResult.success) {
      setSubmitResult({
        type: 'success',
        message: `Purchase Order ${booksResult.purchaseorder.purchaseorder_number} created in Books and CRM.`,
      })
    } else {
      // Books succeeded but CRM failed
      setSubmitResult({
        type: 'error',
        message: `Books PO created (${booksResult.purchaseorder.purchaseorder_number}), but CRM failed: ${crmResult.error}`,
      })
    }
  }

  const handleSaveDraft = (payload) => {
    console.log('[App] Save as Draft:', payload)
    savePO(payload, 'draft')
  }

  const handleSaveAndSend = (payload) => {
    console.log('[App] Save and Send:', payload)
    savePO(payload, 'open')
  }

  const handleCancel = () => {
    console.log('[App] Cancel clicked')
    const ZOHO = window.ZOHO
    if (ZOHO) {
      ZOHO.CRM.UI.closePopup()
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-muted-foreground text-sm">Loading...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-destructive text-sm">{error}</p>
      </div>
    )
  }

  return (
    <PurchaseOrderForm
      vendor={vendor}
      items={items}
      taxes={taxes}
      initialPONumber={poNumber}
      onSaveDraft={handleSaveDraft}
      onSaveAndSend={handleSaveAndSend}
      onCancel={handleCancel}
      submitting={submitting}
      submitResult={submitResult}
    />
  )
}

export default App
