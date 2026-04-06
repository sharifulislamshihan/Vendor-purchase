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
  }
  if (body) {
    // Send JSONString as a URL parameter instead of body
    params.url = fullUrl + '&JSONString=' + encodeURIComponent(JSON.stringify(body))
    console.log('[zohoService] Request URL with JSONString:', params.url)
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
  const purchaseItems = allItems.filter(item => item.item_type === 'purchases')
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
    payload.is_discount_before_tax = true
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

// Build CRM Product_Details from Books PO line items
const buildCRMProductDetails = async (booksPOLineItems) => {
  const ZOHO = getZOHO()
  if (!ZOHO || !booksPOLineItems?.length) return []

  const productDetails = []

  for (const line of booksPOLineItems) {
    console.log('[zohoService] Books line item:', JSON.stringify(line))

    let crmProductId = null
    try {
      const searchRes = await ZOHO.CRM.API.searchRecord({
        Entity: 'Products',
        Type: 'criteria',
        Query: `(ZB_item_id:equals:${line.item_id})`,
      })
      if (searchRes?.data?.[0]) {
        crmProductId = searchRes.data[0].id
      }
    } catch (err) {
      console.warn('[zohoService] Product search failed for item:', line.item_id, err)
    }

    if (crmProductId) {
      const lineDetail = {
        product: { id: crmProductId },
        quantity: line.quantity,
        list_price: line.rate,
      }

      // Tax — try line_tax format for CRM
      const taxPct = parseFloat(line.tax_percentage) || 0
      if (line.tax_name && taxPct > 0) {
        lineDetail.line_tax = [
          {
            name: line.tax_name,
            percentage: taxPct,
          },
        ]
        console.log('[zohoService] Line tax set:', line.tax_name, taxPct + '%')
      }

      productDetails.push(lineDetail)
    }
  }

  return productDetails
}

// Build CRM discount from Books PO response
const getCRMDiscount = (booksPO) => {
  // Log all discount-related fields from Books to find the right one
  console.log('[zohoService] Books discount fields:', {
    discount: booksPO.discount,
    discount_amount: booksPO.discount_amount,
    discount_total: booksPO.discount_total,
    discount_type: booksPO.discount_type,
    is_discount_before_tax: booksPO.is_discount_before_tax,
  })

  // Try discount_amount first (calculated amount), then discount_total, then discount
  const amount = parseFloat(booksPO.discount_amount)
    || parseFloat(booksPO.discount_total)
    || parseFloat(booksPO.discount)
    || 0
  return amount
}

// Create Purchase Order in CRM and link to Vendor
export const createCRMPurchaseOrder = async (booksPO, crmVendorId, formData, status) => {
  const ZOHO = getZOHO()
  if (!ZOHO) {
    console.warn('[zohoService] ZOHO SDK not available')
    return { success: false, error: 'ZOHO SDK not available' }
  }

  console.log('[zohoService] Creating PO in CRM for vendor:', crmVendorId)
  console.log('[zohoService] Books PO full response:', JSON.stringify(booksPO, null, 2))

  const crmRecord = {
    Subject: booksPO.purchaseorder_number,
    PO_Number: booksPO.purchaseorder_number.replace(/^\D+/, ''),
    PO_Date: formData.date,
    Due_Date: formData.deliveryDate || null,
    Vendor_Name: { id: crmVendorId },
    Status: status === 'draft' ? 'Draft' : 'Issued',
    Zoho_Books_PO_ID: booksPO.purchaseorder_id,
    Adjustment: parseFloat(booksPO.adjustment) || 0,
    Discount: getCRMDiscount(booksPO),
  }

  // Build line items with tax
  const productDetails = await buildCRMProductDetails(booksPO.line_items)
  if (productDetails.length > 0) {
    crmRecord.Product_Details = productDetails
  }

  console.log('[zohoService] CRM PO record:', JSON.stringify(crmRecord, null, 2))

  try {
    const response = await ZOHO.CRM.API.insertRecord({
      Entity: 'Purchase_Orders',
      APIData: crmRecord,
      Trigger: ['workflow'],
    })
    console.log('[zohoService] CRM PO response:', response)

    if (response?.data?.[0]?.code === 'SUCCESS') {
      const crmPOId = response.data[0].details.id
      console.log('[zohoService] CRM PO created:', crmPOId)
      return { success: true, id: crmPOId }
    }

    const errMsg = response?.data?.[0]?.message || 'Failed to create CRM PO'
    console.error('[zohoService] CRM PO failed:', errMsg)
    return { success: false, error: errMsg }
  } catch (err) {
    console.error('[zohoService] CRM PO creation error:', err)
    return { success: false, error: err.message || 'CRM API error' }
  }
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
    payload.is_discount_before_tax = true
    payload.discount_type = 'entity_level'
    if (formData.discountAccountId) {
      payload.discount_account_id = formData.discountAccountId
    }
  } else {
    payload.discount = '0'
  }

  // Adjustment
  const adjustmentVal = parseFloat(formData.adjustment) || 0
  if (adjustmentVal !== 0) {
    payload.adjustment = adjustmentVal
  }

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

// Update Purchase Order in CRM (full update including line items, tax, discount)
export const updateCRMPurchaseOrder = async (crmPoId, booksPO, formData) => {
  const ZOHO = getZOHO()
  if (!ZOHO) return { success: false, error: 'ZOHO SDK not available' }

  console.log('[zohoService] Updating CRM PO:', crmPoId)

  console.log('[zohoService] Books PO for CRM update:', JSON.stringify(booksPO, null, 2))

  const statusMap = { draft: 'Draft', open: 'Issued', billed: 'Delivered', closed: 'Delivered' }
  const crmRecord = {
    Subject: booksPO.purchaseorder_number,
    PO_Date: formData.date,
    Due_Date: formData.deliveryDate || null,
    Adjustment: parseFloat(booksPO.adjustment) || 0,
    Discount: getCRMDiscount(booksPO),
    Status: statusMap[booksPO.status] || statusMap[formData.status] || 'Draft',
  }

  // Rebuild line items with tax
  const productDetails = await buildCRMProductDetails(booksPO.line_items)
  if (productDetails.length > 0) {
    crmRecord.Product_Details = productDetails
  }

  console.log('[zohoService] CRM PO update record:', JSON.stringify(crmRecord, null, 2))

  try {
    const response = await ZOHO.CRM.API.updateRecord({
      Entity: 'Purchase_Orders',
      RecordID: crmPoId,
      APIData: crmRecord,
      Trigger: ['workflow'],
    })
    console.log('[zohoService] CRM PO update response:', response)

    if (response?.data?.[0]?.code === 'SUCCESS') {
      return { success: true }
    }
    return { success: false, error: response?.data?.[0]?.message || 'CRM update failed' }
  } catch (err) {
    console.error('[zohoService] CRM PO update error:', err)
    return { success: false, error: err.message || 'CRM API error' }
  }
}

// Convert Purchase Order to Bill in Zoho Books (native conversion)
export const convertPOToBill = async (po, billDate, billDueDate) => {
  console.log('[zohoService] Converting PO to Bill:', po.purchaseorder_id)
  console.log('[zohoService] Full PO for conversion:', JSON.stringify(po, null, 2))

  // Fetch next bill number
  const billList = await callBooksAPI('/bills?sort_column=created_time&sort_order=D')
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

  if (po.notes) payload.notes = po.notes
  if (po.terms) payload.terms = po.terms

  console.log('[zohoService] Bill payload:', JSON.stringify(payload, null, 2))

  const data = await callBooksAPI('/bills', 'POST', payload)
  console.log('[zohoService] Bill create response:', data)

  if (data?.code === 0 && data?.bill) {
    console.log('[zohoService] Bill created:', data.bill.bill_id, '— PO should now be billed')

    // Update CRM PO status to Delivered (billed)
    const ZOHO = getZOHO()
    if (ZOHO) {
      const crmPO = await findCRMPurchaseOrder(po.purchaseorder_id)
      if (crmPO) {
        try {
          await ZOHO.CRM.API.updateRecord({
            Entity: 'Purchase_Orders',
            RecordID: crmPO.id,
            APIData: { Status: 'Delivered' },
            Trigger: ['workflow'],
          })
          console.log('[zohoService] CRM PO marked as Delivered')
        } catch (err) {
          console.warn('[zohoService] CRM status update failed:', err)
        }
      }
    }

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

// Delete Purchase Order from CRM
export const deleteCRMPurchaseOrder = async (crmPoId) => {
  const ZOHO = getZOHO()
  if (!ZOHO) return { success: false, error: 'ZOHO SDK not available' }

  console.log('[zohoService] Deleting CRM PO:', crmPoId)
  try {
    const response = await ZOHO.CRM.API.deleteRecord({
      Entity: 'Purchase_Orders',
      RecordID: crmPoId,
    })
    console.log('[zohoService] CRM delete response:', response)

    if (response?.data?.[0]?.code === 'SUCCESS') {
      return { success: true }
    }
    return { success: false, error: response?.data?.[0]?.message || 'CRM delete failed' }
  } catch (err) {
    console.error('[zohoService] CRM PO delete error:', err)
    return { success: false, error: err.message || 'CRM API error' }
  }
}

// Find CRM Purchase Order by Zoho Books PO ID
export const findCRMPurchaseOrder = async (booksPOId) => {
  const ZOHO = getZOHO()
  if (!ZOHO) return null

  try {
    const searchRes = await ZOHO.CRM.API.searchRecord({
      Entity: 'Purchase_Orders',
      Type: 'criteria',
      Query: `(Zoho_Books_PO_ID:equals:${booksPOId})`,
    })
    return searchRes?.data?.[0] || null
  } catch (err) {
    console.warn('[zohoService] CRM PO search failed:', err)
    return null
  }
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

// Upload attachment to Purchase Order in Zoho CRM
export const uploadCRMPOAttachment = async (crmPoId, file) => {
  const ZOHO = getZOHO()
  if (!ZOHO) return { success: false, error: 'ZOHO SDK not available' }

  console.log('[zohoService] Uploading attachment to CRM PO:', crmPoId, file.name)

  try {
    const response = await ZOHO.CRM.API.attachFile({
      Entity: 'Purchase_Orders',
      RecordID: crmPoId,
      File: { Name: file.name, Content: file },
    })
    console.log('[zohoService] CRM attachment response:', response)

    if (response?.data?.[0]?.code === 'SUCCESS') {
      return { success: true }
    }
    return { success: false, error: response?.data?.[0]?.message || 'CRM attachment failed' }
  } catch (err) {
    console.error('[zohoService] CRM attachment error:', err)
    return { success: false, error: err.message || 'CRM attachment failed' }
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
