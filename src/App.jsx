import { useEffect, useState } from 'react'
import { getVendorRecord, resizeWidget, fetchItems, fetchTaxes, fetchNextPONumber, createBooksPurchaseOrder, createCRMPurchaseOrder } from './services/zohoService'
import PurchaseOrderForm from './components/PurchaseOrderForm'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './components/ui/dialog'
import { Button } from './components/ui/button'

function App({ pageData }) {
  const isDevMode = !pageData?.EntityId?.[0] || pageData?.EntityId?.[0] === 'DEV_VENDOR_ID'
  const [vendor, setVendor] = useState(isDevMode ? { Vendor_Name: 'Dev Mode Vendor', Books_Contact_ID: 'DEV_123' } : null)
  const [loading, setLoading] = useState(!isDevMode)
  const [error, setError] = useState(null)
  const [items, setItems] = useState([])
  const [taxes, setTaxes] = useState([])
  const [poNumber, setPoNumber] = useState('')
  const [submitting, setSubmitting] = useState(null)
  const [submitResult, setSubmitResult] = useState(null)
  const [successInfo, setSuccessInfo] = useState(null)

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
    setSubmitting(status === 'draft' ? 'draft' : 'send')
    setSubmitResult(null)

    // Step 1: Create PO in Zoho Books
    const booksResult = await createBooksPurchaseOrder(payload, status)
    console.log('[App] Books result:', booksResult)

    if (!booksResult.success) {
      setSubmitting(null)
      setSubmitResult({ type: 'error', message: `Books: ${booksResult.error}` })
      return
    }

    // Step 2: Create PO in CRM + link to Vendor
    const crmResult = await createCRMPurchaseOrder(booksResult.purchaseorder, crmVendorId, payload, status)
    console.log('[App] CRM result:', crmResult)

    setSubmitting(null)

    if (crmResult.success) {
      setSuccessInfo({
        poNumber: booksResult.purchaseorder.purchaseorder_number,
        status: status === 'draft' ? 'Draft' : 'Sent',
      })
      return
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
    if (ZOHO) ZOHO.CRM.UI.Popup.close()
  }

  const handleSuccessClose = () => {
    const ZOHO = window.ZOHO
    if (ZOHO) ZOHO.CRM.UI.Popup.closeReload()
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-3">
        <div className="h-8 w-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        <p className="text-muted-foreground text-sm">Loading purchase order data...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-2">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-500"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
        </div>
        <p className="text-destructive text-sm font-medium">{error}</p>
        <p className="text-muted-foreground text-xs">Please close and try again.</p>
      </div>
    )
  }

  return (
    <>
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
        onDismissResult={() => setSubmitResult(null)}
      />

      {/* Success Modal */}
      <Dialog open={!!successInfo}>
        <DialogContent showCloseButton={false} className="sm:max-w-sm text-center">
          <DialogHeader className="items-center">
            <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-green-600"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <DialogTitle className="text-lg">Purchase Order Created!</DialogTitle>
            <DialogDescription>
              <span className="font-semibold text-foreground">{successInfo?.poNumber}</span> has been successfully created in Zoho Books and CRM
              {successInfo?.status === 'Draft' ? ' as a draft.' : ' and sent to the vendor.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-center">
            <Button onClick={handleSuccessClose} className="px-8">
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default App
