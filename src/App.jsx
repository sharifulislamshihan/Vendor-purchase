import { useEffect, useState, useCallback } from 'react'
import {
  getVendorRecord, resizeWidget,
  fetchItems, fetchTaxes, fetchPaymentTerms, fetchDiscountAccounts, fetchNextPONumber,
  fetchVendorPurchaseOrders, fetchPurchaseOrderDetail,
  createBooksPurchaseOrder,
  updateBooksPurchaseOrder,
  deleteBooksPurchaseOrder,
  uploadBooksPOAttachment,
  fetchPOAttachments, deletePOAttachment,
  convertPOToBill,
} from './services/zohoService'
import PurchaseOrderList from './components/PurchaseOrderList'
import PurchaseOrderDetail from './components/PurchaseOrderDetail'
import PurchaseOrderForm from './components/PurchaseOrderForm'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './components/ui/dialog'
import { DatePicker } from './components/ui/date-picker'
import { Label } from './components/ui/label'
import { Button } from './components/ui/button'

const getEntityId = (pageData) => {
  const eid = pageData?.EntityId
  return Array.isArray(eid) ? eid[0] : eid || null
}

function App({ pageData }) {
  const vendorRecordId = getEntityId(pageData)
  const isDevMode = !vendorRecordId || vendorRecordId === 'DEV_VENDOR_ID'
  const [vendor, setVendor] = useState(isDevMode ? { Vendor_Name: 'Dev Mode Vendor', Books_Contact_ID: 'DEV_123' } : null)
  const [loading, setLoading] = useState(!isDevMode)
  const [error, setError] = useState(null)

  // Shared data for form
  const [items, setItems] = useState([])
  const [taxes, setTaxes] = useState([])
  const [paymentTerms, setPaymentTerms] = useState([])
  const [discountAccounts, setDiscountAccounts] = useState([])

  // View state: 'list' | 'view' | 'create' | 'edit'
  const [view, setView] = useState('list')
  const [viewData, setViewData] = useState(null)
  const [editData, setEditData] = useState(null)
  const [existingAttachments, setExistingAttachments] = useState([])

  // List state
  const [purchaseOrders, setPurchaseOrders] = useState([])
  const [listLoading, setListLoading] = useState(false)
  const [deleting, setDeleting] = useState(null)
  const [converting, setConverting] = useState(null)
  const [convertConfirm, setConvertConfirm] = useState(null)
  const [billDate, setBillDate] = useState('')
  const [billDueDate, setBillDueDate] = useState('')

  // Form state
  const [poNumber, setPoNumber] = useState('')
  const [submitting, setSubmitting] = useState(null)
  const [submitResult, setSubmitResult] = useState(null)
  const [successInfo, setSuccessInfo] = useState(null)
  const [updateConfirm, setUpdateConfirm] = useState(null)

  // Load PO list for the vendor
  const loadPurchaseOrders = useCallback(async (booksContactId) => {
    if (!booksContactId || booksContactId === 'DEV_123') return
    setListLoading(true)
    try {
      const pos = await fetchVendorPurchaseOrders(booksContactId)
      setPurchaseOrders(pos)
    } catch (err) {
      console.error('[App] Failed to load POs:', err)
    } finally {
      setListLoading(false)
    }
  }, [])

  useEffect(() => {
    resizeWidget(1200, 700)

    if (!vendorRecordId || vendorRecordId === 'DEV_VENDOR_ID') {
      return
    }

    Promise.all([
      getVendorRecord(vendorRecordId),
      fetchItems(),
      fetchTaxes(),
      fetchPaymentTerms(),
      fetchDiscountAccounts(),
    ])
      .then(([vendorData, itemsData, taxesData, paymentTermsData, discountAccountsData]) => {
        if (vendorData) {
          setVendor(vendorData)
          loadPurchaseOrders(vendorData.Books_Contact_ID)
        } else {
          setError('Vendor not found')
        }
        setItems(itemsData)
        setTaxes(taxesData)
        setPaymentTerms(paymentTermsData)
        setDiscountAccounts(discountAccountsData)
      })
      .catch((err) => {
        console.error('[App] Error loading data:', err)
        setError('Failed to load data')
      })
      .finally(() => setLoading(false))
  }, [vendorRecordId, loadPurchaseOrders])

  // --- Create handlers ---
  const handleCreateNew = async () => {
    setSubmitResult(null)
    const nextPO = await fetchNextPONumber()
    setPoNumber(nextPO || '')
    setView('create')
  }

  const handleRefreshItems = async () => {
    const freshItems = await fetchItems()
    setItems(freshItems)
  }

  // Upload attachments to Books PO
  const uploadAttachments = async (booksPOId, files) => {
    if (!files?.length) return
    console.log('[App] Uploading', files.length, 'attachment(s)')

    for (const file of files) {
      const booksRes = await uploadBooksPOAttachment(booksPOId, file)
      console.log('[App] Books attachment result:', file.name, booksRes)
    }
  }

  const savePO = async (payload, status) => {
    setSubmitting(status === 'draft' ? 'draft' : 'send')
    setSubmitResult(null)

    const booksResult = await createBooksPurchaseOrder(payload, status)
    if (!booksResult.success) {
      setSubmitting(null)
      setSubmitResult({ type: 'error', message: `Books: ${booksResult.error}` })
      return
    }

    // Upload attachments after PO is created
    const booksPOId = booksResult.purchaseorder.purchaseorder_id
    await uploadAttachments(booksPOId, payload.attachments)

    setSubmitting(null)
    setSuccessInfo({
      poNumber: booksResult.purchaseorder.purchaseorder_number,
      status: status === 'draft' ? 'Draft' : 'Sent',
    })
  }

  // --- View handler ---
  const handleView = async (po) => {
    setViewData(null)
    setExistingAttachments([])
    setView('view')

    const detail = await fetchPurchaseOrderDetail(po.purchaseorder_id)
    if (detail) {
      setViewData(detail)
      setExistingAttachments(detail.documents || detail.attachments || [])
    } else {
      setView('list')
    }
  }

  // --- Edit handlers ---
  const handleEdit = async (po) => {
    setSubmitResult(null)
    setEditData(null)
    setExistingAttachments([])
    setView('edit')

    // Fetch full PO detail from Books
    const detail = await fetchPurchaseOrderDetail(po.purchaseorder_id)
    if (detail) {
      setEditData(detail)
      setExistingAttachments(detail.documents || detail.attachments || [])
    } else {
      setSubmitResult({ type: 'error', message: 'Failed to load purchase order details' })
      setView('list')
    }
  }

  // --- Delete attachment handler (edit mode only) ---
  const handleDeleteAttachment = async (poId, documentId) => {
    const result = await deletePOAttachment(poId, documentId)
    if (result.success) {
      // Re-fetch fresh attachment list from Books
      const attachments = await fetchPOAttachments(poId)
      setExistingAttachments(attachments)
    }
    return result
  }

  const handleUpdateRequest = (payload) => {
    setUpdateConfirm(payload)
  }

  const handleUpdateConfirm = async () => {
    const payload = updateConfirm
    if (!editData || !payload) return
    setUpdateConfirm(null)
    setSubmitting('update')
    setSubmitResult(null)

    const booksResult = await updateBooksPurchaseOrder(editData.purchaseorder_id, payload)
    if (!booksResult.success) {
      setSubmitting(null)
      setSubmitResult({ type: 'error', message: `Books: ${booksResult.error}` })
      return
    }

    // Upload any new attachments
    await uploadAttachments(editData.purchaseorder_id, payload.attachments)

    setSubmitting(null)
    setSuccessInfo({
      poNumber: booksResult.purchaseorder.purchaseorder_number,
      status: 'Updated',
    })
  }

  // --- Delete handler ---
  const handleDelete = async (booksPOId) => {
    setDeleting(booksPOId)

    const booksResult = await deleteBooksPurchaseOrder(booksPOId)
    if (!booksResult.success) {
      setDeleting(null)
      setSubmitResult({ type: 'error', message: `Books: ${booksResult.error}` })
      return
    }

    setDeleting(null)
    loadPurchaseOrders(vendor?.Books_Contact_ID)
  }

  // --- Convert to Bill ---
  const handleConvertToBill = (po) => {
    const today = new Date().toISOString().split('T')[0]
    setBillDate(today)
    setBillDueDate('')
    setConvertConfirm(po)
  }

  const handleConvertConfirm = async () => {
    const po = convertConfirm
    if (!po) return
    setConvertConfirm(null)
    setConverting(po.purchaseorder_id)

    // Fetch full detail to ensure we have vendor_id
    const detail = await fetchPurchaseOrderDetail(po.purchaseorder_id)
    if (!detail) {
      setConverting(null)
      setSubmitResult({ type: 'error', message: 'Failed to load PO details' })
      return
    }

    // Books handles line items/taxes automatically via purchaseorder_ids
    const result = await convertPOToBill(detail, billDate, billDueDate)
    setConverting(null)

    if (result.success) {
      // Refresh list to show updated "billed" status
      loadPurchaseOrders(vendor?.Books_Contact_ID)
      setSuccessInfo({
        poNumber: po.purchaseorder_number,
        status: 'Billed',
        billNumber: result.bill.bill_number,
      })
    } else {
      setSubmitResult({ type: 'error', message: `Convert to Bill failed: ${result.error}` })
    }
  }

  // --- Navigation ---
  const handleCancel = () => {
    setSubmitResult(null)
    setEditData(null)
    setView('list')
  }

  const handleSuccessClose = () => {
    setSuccessInfo(null)
    setEditData(null)
    setView('list')
    loadPurchaseOrders(vendor?.Books_Contact_ID)
  }

  // --- Render ---
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-3">
        <div className="h-8 w-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        <p className="text-muted-foreground text-sm">Loading...</p>
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
      {view === 'list' && (
        <PurchaseOrderList
          vendor={vendor}
          purchaseOrders={purchaseOrders}
          loading={listLoading}
          onCreateNew={handleCreateNew}
          onRefreshItems={handleRefreshItems}
          onView={handleView}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onConvertToBill={handleConvertToBill}
          deleting={deleting}
          converting={converting}
        />
      )}

      {view === 'view' && (
        <PurchaseOrderDetail
          po={viewData}
          attachments={existingAttachments}
          onBack={handleCancel}
          onEdit={(po) => handleEdit(po)}
          onDelete={(po) => {
            setView('list')
            handleDelete(po.purchaseorder_id)
          }}
          onConvertToBill={(po) => handleConvertToBill(po)}
        />
      )}

      {view === 'create' && (
        <PurchaseOrderForm
          key={poNumber}
          vendor={vendor}
          items={items}
          taxes={taxes}
          paymentTerms={paymentTerms}
          defaultPaymentTerm={paymentTerms[0]?.payment_terms_label || ''}
          discountAccounts={discountAccounts}
          initialPONumber={poNumber}

          onSaveDraft={(payload) => savePO(payload, 'draft')}
          onSaveAndSend={(payload) => savePO(payload, 'open')}
          onCancel={handleCancel}
          submitting={submitting}
          submitResult={submitResult}
          onDismissResult={() => setSubmitResult(null)}
        />
      )}

      {view === 'edit' && !editData && (
        <div className="flex flex-col items-center justify-center h-screen gap-3">
          <div className="h-8 w-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm">Loading purchase order...</p>
        </div>
      )}

      {view === 'edit' && editData && (
        <PurchaseOrderForm
          key={editData.purchaseorder_id}
          vendor={vendor}
          items={items}
          taxes={taxes}
          paymentTerms={paymentTerms}
          defaultPaymentTerm={paymentTerms[0]?.payment_terms_label || ''}
          discountAccounts={discountAccounts}
          editData={editData}
          existingAttachments={existingAttachments}
          onDeleteAttachment={(documentId) => handleDeleteAttachment(editData.purchaseorder_id, documentId)}

          onUpdate={handleUpdateRequest}
          onCancel={handleCancel}
          submitting={submitting}
          submitResult={submitResult}
          onDismissResult={() => setSubmitResult(null)}
        />
      )}

      {/* Update Confirmation Dialog */}
      <Dialog open={!!updateConfirm} onOpenChange={(open) => !open && setUpdateConfirm(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader className="items-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </div>
            <DialogTitle className="text-center">Confirm Update</DialogTitle>
            <DialogDescription className="text-center">
              Are you sure you want to update <span className="font-semibold text-foreground">{editData?.purchaseorder_number}</span>? This will update the purchase order in Zoho Books.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-center">
            <Button variant="outline" onClick={() => setUpdateConfirm(null)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateConfirm}>
              Confirm Update
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Convert to Bill Dialog */}
      <Dialog open={!!convertConfirm} onOpenChange={(open) => !open && setConvertConfirm(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-600"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><polyline points="9 15 12 18 15 15"/><line x1="12" y1="12" x2="12" y2="18"/></svg>
            </div>
            <DialogTitle className="text-center">Convert to Bill</DialogTitle>
            <DialogDescription className="text-center">
              Convert <span className="font-semibold text-foreground">{convertConfirm?.purchaseorder_number}</span> into a Bill in Zoho Books.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Bill Date</Label>
              <DatePicker
                value={billDate}
                onChange={setBillDate}
                placeholder="Select bill date"
                className="w-full h-10"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Due Date</Label>
              <DatePicker
                value={billDueDate}
                onChange={setBillDueDate}
                placeholder="Select due date"
                className="w-full h-10"
                disabledDays={billDate ? { before: new Date(billDate + 'T00:00:00') } : undefined}
              />
              {billDueDate && billDate && billDueDate < billDate && (
                <p className="text-xs text-destructive">Due date must be after bill date</p>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:justify-end">
            <Button variant="outline" onClick={() => setConvertConfirm(null)}>
              Cancel
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700"
              onClick={handleConvertConfirm}
              disabled={!billDate}
            >
              Convert to Bill
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Success Modal */}
      <Dialog open={!!successInfo}>
        <DialogContent showCloseButton={false} className="sm:max-w-sm text-center">
          <DialogHeader className="items-center">
            <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-green-600"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <DialogTitle className="text-lg">
              {successInfo?.status === 'Billed'
                ? 'Converted to Bill!'
                : successInfo?.status === 'Updated'
                  ? 'Purchase Order Updated!'
                  : 'Purchase Order Created!'
              }
            </DialogTitle>
            <DialogDescription>
              {successInfo?.status === 'Billed'
                ? <><span className="font-semibold text-foreground">{successInfo?.poNumber}</span> has been converted to Bill <span className="font-semibold text-foreground">{successInfo?.billNumber}</span> in Zoho Books.</>
                : <><span className="font-semibold text-foreground">{successInfo?.poNumber}</span> has been successfully
                  {successInfo?.status === 'Updated'
                    ? ' updated in Zoho Books.'
                    : successInfo?.status === 'Draft'
                      ? ' saved as a draft in Zoho Books.'
                      : ' created and sent to the vendor.'
                  }</>
              }
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
