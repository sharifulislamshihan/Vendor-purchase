const getZOHO = () => window.ZOHO

// Fetch vendor record from CRM by ID
export const getVendorRecord = async (vendorId) => {
  const ZOHO = getZOHO()
  if (!ZOHO) {
    console.warn('[zohoService] ZOHO SDK not available')
    return null
  }

  console.log('[zohoService] Fetching vendor:', vendorId)
  try {
    const response = await ZOHO.CRM.API.getRecord({ Entity: 'Vendors', RecordID: vendorId })
    console.log('[zohoService] Vendor response:', response)
    return response?.data?.[0] || null
  } catch (err) {
    console.error('[zohoService] Fetch vendor failed:', err)
    return null
  }
}

const BOOKS_ORG_ID = '771340721'
const CONNECTION_NAME = 'zoho_book_conn_test'


// Helper to call Zoho Books API via CRM Connection
const callBooksAPI = async (url, method = 'GET', body = null) => {
  const ZOHO = getZOHO()
  if (!ZOHO) {
    console.warn('[zohoService] ZOHO SDK not available')
    return null
  }

  const fullUrl = `https://www.zohoapis.com/books/v3${url}${url.includes('?') ? '&' : '?'}organization_id=${BOOKS_ORG_ID}`

  const params = {
    url: fullUrl,
    method,
    param_type: 1,
    parameters: {},
  }
  if (body) {
    params.parameters = { JSONString: JSON.stringify(body) }
    console.log('[zohoService] Request payload:', params.parameters)
  }

  console.log('[zohoService] Books API call:', method, url)
  try {
    const response = await ZOHO.CRM.CONNECTION.invoke(CONNECTION_NAME, params)
    console.log('[zohoService] Books API response:', response)

    // CRM Connection wraps response — extract actual data
    const result = response?.details?.statusMessage
    if (typeof result === 'string') {
      return JSON.parse(result)
    }
    return result || null
  } catch (err) {
    console.error('[zohoService] Books API failed:', err)
    return null
  }
}

// Fetch next auto-generated PO number from Zoho Books
export const fetchNextPONumber = async () => {
  console.log('[zohoService] Fetching next PO number...')

  // Fallback: fetch latest PO and increment
  const poList = await callBooksAPI('/purchaseorders')
  console.log('[zohoService] PO list response:', poList)

  if (poList?.purchaseorders?.length > 0) {
    const lastPO = poList.purchaseorders[0]
    const lastNumber = lastPO.purchaseorder_number
    console.log('[zohoService] Last PO number:', lastNumber)

    // Try to increment: "PO-00001" -> "PO-00002"
    const match = lastNumber.match(/^(.*?)(\d+)$/)
    if (match) {
      const prefix = match[1]
      const num = parseInt(match[2], 10) + 1
      const padded = String(num).padStart(match[2].length, '0')
      return `${prefix}${padded}`
    }
  }

  return 'PO-00001'
}

// Fetch items/products from Zoho Books
export const fetchItems = async () => {
  console.log('[zohoService] Fetching items from Books...')
  const data = await callBooksAPI('/items')
  console.log('[zohoService] Items data:', data)
  const allItems = data?.items || []
  const purchaseItems = allItems.filter(item =>
    item.item_type === 'purchases' || item.item_type === 'sales_and_purchases' || item.item_type === 'inventory'
  )
  console.log('[zohoService] Purchase items:', purchaseItems.length, '/', allItems.length)
  return purchaseItems
}

// Fetch taxes from Zoho Books
export const fetchTaxes = async () => {
  console.log('[zohoService] Fetching taxes from Books...')
  const data = await callBooksAPI('/settings/taxes')
  console.log('[zohoService] Taxes data:', data)
  return data?.taxes || []
}

// Fetch payment terms from Zoho Books
export const fetchPaymentTerms = async () => {
  console.log('[zohoService] Fetching payment terms from Books...')
  const data = await callBooksAPI('/settings/paymentterms')
  console.log('[zohoService] Payment terms data:', data)
  return data?.data?.payment_terms || data?.payment_terms || []
}

// Fetch discount-eligible accounts (Expense / Other Expense) from Zoho Books
export const fetchDiscountAccounts = async () => {
  console.log('[zohoService] Fetching chart of accounts from Books...')
  const data = await callBooksAPI('/chartofaccounts')
  console.log('[zohoService] Chart of accounts data:', data)
  const allAccounts = data?.chartofaccounts || []
  const discountAccounts = allAccounts.filter(
    (a) => a.is_active && (a.account_type === 'expense' || a.account_type === 'other_expense')
  )
  console.log('[zohoService] Discount-eligible accounts:', discountAccounts.length)
  return discountAccounts
}

// Create Purchase Order in Zoho Books
export const createBooksPurchaseOrder = async (formData, status = 'draft') => {
  console.log('[zohoService] Creating PO in Books, status:', status)

  // Build line items for Books API
  const lineItems = formData.line_items.map((item) => {
    const lineItem = {
      item_id: item.item_id,
      name: item.name || '',
      quantity: parseFloat(item.quantity) || 1,
      rate: parseFloat(item.rate) || 0,
      description: item.description || '',
    }
    if (item.tax_id) {
      lineItem.tax_id = item.tax_id
    }
    return lineItem
  })

  const payload = {
    vendor_id: formData.vendor_id,
    line_items: lineItems,
    date: formData.date,
    payment_terms_label: formData.paymentTerms,
    notes: formData.notes || '',
    terms: formData.terms || '',
  }

  // PO number
  if (formData.purchaseOrderNumber) {
    payload.purchaseorder_number = formData.purchaseOrderNumber
  }
  if (formData.reference) {
    payload.reference_number = formData.reference
  }
  if (formData.deliveryDate) {
    payload.delivery_date = formData.deliveryDate
  }

  // Discount
  const discountVal = parseFloat(formData.discount) || 0
  if (discountVal > 0) {
    if (formData.discountType === 'percent') {
      payload.discount = `${discountVal}%`
    } else {
      payload.discount = discountVal.toFixed(2)
    }
    payload.is_discount_before_tax = formData.isDiscountBeforeTax !== false
    payload.discount_type = 'entity_level'
    if (formData.discountAccountId) {
      payload.discount_account_id = formData.discountAccountId
    }
  }

  // Adjustment
  const adjustmentVal = parseFloat(formData.adjustment) || 0
  if (adjustmentVal !== 0) {
    payload.adjustment = adjustmentVal
  }

  console.log('[zohoService] Books PO payload:', JSON.stringify(payload, null, 2))

  const data = await callBooksAPI('/purchaseorders', 'POST', payload)
  console.log('[zohoService] Books PO response:', data)

  if (data?.code === 0 && data?.purchaseorder) {
    console.log('[zohoService] PO created successfully:', data.purchaseorder.purchaseorder_id)

    // If "Save and Send" — mark as open
    if (status === 'open') {
      const poId = data.purchaseorder.purchaseorder_id
      console.log('[zohoService] Marking PO as open:', poId)
      const openRes = await callBooksAPI(`/purchaseorders/${poId}/status/open`, 'POST')
      console.log('[zohoService] Mark open response:', openRes)
    }

    return { success: true, purchaseorder: data.purchaseorder }
  }

  console.error('[zohoService] PO creation failed:', data?.message || data)
  return { success: false, error: data?.message || 'Failed to create purchase order' }
}

// Fetch all purchase orders for a vendor from Zoho Books
export const fetchVendorPurchaseOrders = async (booksContactId) => {
  console.log('[zohoService] Fetching POs for vendor:', booksContactId)
  const data = await callBooksAPI(`/purchaseorders?vendor_id=${booksContactId}`)
  console.log('[zohoService] Vendor POs:', data)
  return data?.purchaseorders || []
}

// Fetch single purchase order detail from Zoho Books
export const fetchPurchaseOrderDetail = async (poId) => {
  console.log('[zohoService] Fetching PO detail:', poId)
  const data = await callBooksAPI(`/purchaseorders/${poId}`)
  console.log('[zohoService] PO detail (full response):', JSON.stringify(data, null, 2))
  return data?.purchaseorder || null
}

// Update Purchase Order in Zoho Books
export const updateBooksPurchaseOrder = async (poId, formData) => {
  console.log('[zohoService] Updating PO in Books:', poId)

  const lineItems = formData.line_items.map((item) => {
    const lineItem = {
      item_id: item.item_id,
      name: item.name || '',
      quantity: parseFloat(item.quantity) || 1,
      rate: parseFloat(item.rate) || 0,
      description: item.description || '',
    }
    if (item.tax_id) {
      lineItem.tax_id = item.tax_id
    }
    return lineItem
  })

  const payload = {
    line_items: lineItems,
    date: formData.date,
    payment_terms_label: formData.paymentTerms,
    notes: formData.notes || '',
    terms: formData.terms || '',
  }

  // Always send these so clearing them in edit actually removes the value in Books
  payload.reference_number = formData.reference || ''
  payload.delivery_date = formData.deliveryDate || ''

  // Discount
  const discountVal = parseFloat(formData.discount) || 0
  if (discountVal > 0) {
    if (formData.discountType === 'percent') {
      payload.discount = `${discountVal}%`
    } else {
      payload.discount = discountVal.toFixed(2)
    }
    payload.is_discount_before_tax = formData.isDiscountBeforeTax !== false
    payload.discount_type = 'entity_level'
    if (formData.discountAccountId) {
      payload.discount_account_id = formData.discountAccountId
    }
  } else {
    payload.discount = '0'
  }

  // Adjustment (always send so it can be reset to 0)
  payload.adjustment = parseFloat(formData.adjustment) || 0

  console.log('[zohoService] Books PO update payload:', JSON.stringify(payload, null, 2))

  const data = await callBooksAPI(`/purchaseorders/${poId}`, 'PUT', payload)
  console.log('[zohoService] Books PO update response:', data)

  if (data?.code === 0 && data?.purchaseorder) {
    // Change status if requested
    const desiredStatus = formData.status
    const currentStatus = data.purchaseorder.status
    if (desiredStatus && desiredStatus !== currentStatus) {
      console.log('[zohoService] Changing PO status:', currentStatus, '->', desiredStatus)
      const statusRes = await callBooksAPI(`/purchaseorders/${poId}/status/${desiredStatus}`, 'POST')
      console.log('[zohoService] Status change response:', statusRes)
      if (statusRes?.code === 0) {
        data.purchaseorder.status = desiredStatus
      }
    }
    return { success: true, purchaseorder: data.purchaseorder }
  }

  return { success: false, error: data?.message || 'Failed to update purchase order' }
}

// Convert Purchase Order to Bill in Zoho Books (native conversion)
export const convertPOToBill = async (po, billDate, billDueDate) => {
  console.log('[zohoService] Converting PO to Bill:', po.purchaseorder_id)
  console.log('[zohoService] Full PO for conversion:', JSON.stringify(po, null, 2))

  // Fetch next bill number (auto-numbering may be off in Books)
  const billList = await callBooksAPI('/bills?sort_column=created_time&sort_order=D&per_page=1')
  let billNumber = 'BILL-00001'
  if (billList?.bills?.length > 0) {
    const lastBill = billList.bills[0].bill_number
    const match = lastBill.match(/^(.*?)(\d+)$/)
    if (match) {
      const num = parseInt(match[2], 10) + 1
      billNumber = `${match[1]}${String(num).padStart(match[2].length, '0')}`
    }
  }

  // Build line items with purchaseorder_item_id to link back to the PO
  const lineItems = (po.line_items || []).map((li) => {
    const item = {
      item_id: li.item_id,
      rate: li.rate,
      quantity: li.quantity,
      purchaseorder_item_id: li.line_item_id,
    }
    if (li.tax_id) item.tax_id = li.tax_id
    if (li.account_id) item.account_id = li.account_id
    if (li.description) item.description = li.description
    return item
  })

  const payload = {
    vendor_id: po.vendor_id,
    bill_number: billNumber,
    reference_number: po.purchaseorder_number,
    date: billDate || new Date().toISOString().split('T')[0],
    purchaseorder_ids: [po.purchaseorder_id],
    line_items: lineItems,
  }

  if (billDueDate) {
    payload.due_date = billDueDate
  }

  // Carry over discount from PO
  const discount = parseFloat(po.discount) || 0
  if (discount > 0) {
    payload.discount = po.is_discount_before_tax && po.discount_type === 'entity_level'
      ? po.discount
      : String(discount)
    payload.is_discount_before_tax = po.is_discount_before_tax !== false
    payload.discount_type = 'entity_level'
    if (po.discount_account_id) {
      payload.discount_account_id = po.discount_account_id
    }
  }

  // Carry over adjustment from PO
  const adjustment = parseFloat(po.adjustment) || 0
  if (adjustment !== 0) {
    payload.adjustment = adjustment
  }

  if (po.notes) payload.notes = po.notes
  if (po.terms) payload.terms = po.terms

  console.log('[zohoService] Bill payload:', JSON.stringify(payload, null, 2))

  const data = await callBooksAPI('/bills', 'POST', payload)
  console.log('[zohoService] Bill create response:', data)

  if (data?.code === 0 && data?.bill) {
    console.log('[zohoService] Bill created:', data.bill.bill_id, '— PO should now be billed')
    return { success: true, bill: data.bill }
  }

  return { success: false, error: data?.message || 'Failed to convert to bill' }
}

// Delete Purchase Order from Zoho Books
export const deleteBooksPurchaseOrder = async (poId) => {
  console.log('[zohoService] Deleting PO from Books:', poId)
  const data = await callBooksAPI(`/purchaseorders/${poId}`, 'DELETE')
  console.log('[zohoService] Books delete response:', data)

  if (data?.code === 0) {
    return { success: true }
  }
  return { success: false, error: data?.message || 'Failed to delete purchase order' }
}

// Convert a File to base64 string
const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// Upload attachment to Purchase Order in Zoho Books via CRM Deluge function
// CRM Connection cannot do multipart uploads — use Deluge function instead
export const uploadBooksPOAttachment = async (poId, file) => {
  const ZOHO = getZOHO()
  if (!ZOHO) return { success: false, error: 'ZOHO SDK not available' }

  console.log('[zohoService] Uploading attachment to Books PO via Deluge:', poId, file.name)

  try {
    const base64 = await fileToBase64(file)

    const response = await ZOHO.CRM.FUNCTIONS.execute('attachment_purchase_order', {
      arguments: JSON.stringify({
        entity_id: String(poId),
        entity_type: 'purchaseorders',
        file_name: file.name,
        file_content: base64,
      }),
    })
    console.log('[zohoService] Books attachment response:', response)

    const result = response?.details?.output
    if (result === 'success') {
      return { success: true }
    }
    return { success: false, error: result || 'Attachment upload failed' }
  } catch (err) {
    console.error('[zohoService] Books attachment error:', err)
    return { success: false, error: err.message || 'Attachment upload failed' }
  }
}

// Fetch attachments list for a Purchase Order (embedded in PO detail response)
export const fetchPOAttachments = async (poId) => {
  console.log('[zohoService] Fetching attachments for PO:', poId)
  const data = await callBooksAPI(`/purchaseorders/${poId}`)
  const po = data?.purchaseorder
  console.log('[zohoService] PO attachment fields:', {
    has_attachment: po?.has_attachment,
    documents: po?.documents,
    attachments: po?.attachments,
  })
  return po?.documents || po?.attachments || []
}

// Delete a single attachment from a Purchase Order in Zoho Books
export const deletePOAttachment = async (poId, documentId) => {
  console.log('[zohoService] Deleting attachment:', documentId, 'from PO:', poId)
  const data = await callBooksAPI(`/purchaseorders/${poId}/documents/${documentId}`, 'DELETE')
  console.log('[zohoService] Delete attachment response:', data)

  if (data?.code === 0) {
    return { success: true }
  }
  return { success: false, error: data?.message || 'Failed to delete attachment' }
}

// Resize widget inside CRM
export const resizeWidget = async (width, height) => {
  const ZOHO = getZOHO()
  if (!ZOHO) return

  try {
    await ZOHO.CRM.UI.Resize({ height, width })
  } catch (err) {
    console.error('[zohoService] Resize failed:', err)
  }
}
