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

  // Try the autonumber settings endpoint
  const data = await callBooksAPI('/settings/preferences')
  console.log('[zohoService] Preferences response:', data)

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
      payload.discount = discountVal.toString()
      payload.is_discount_before_tax = true
      payload.discount_type = 'entity_level'
    } else {
      payload.discount = discountVal.toFixed(2)
      payload.is_discount_before_tax = true
      payload.discount_type = 'entity_level'
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

// Create Purchase Order in CRM and link to Vendor
export const createCRMPurchaseOrder = async (booksPO, crmVendorId, formData) => {
  const ZOHO = getZOHO()
  if (!ZOHO) {
    console.warn('[zohoService] ZOHO SDK not available')
    return { success: false, error: 'ZOHO SDK not available' }
  }

  console.log('[zohoService] Creating PO in CRM for vendor:', crmVendorId)

  const crmRecord = {
    Subject: `PO - ${booksPO.purchaseorder_number}`,
    PO_Number: booksPO.purchaseorder_number,
    PO_Date: formData.date,
    Due_Date: formData.deliveryDate || null,
    Vendor_Name: { id: crmVendorId },
    Status: 'Created',
    Zoho_Books_PO_ID: booksPO.purchaseorder_id,
  }

  // Add line items as Product_Details (CRM inventory line items)
  if (booksPO.line_items?.length > 0) {
    const productDetails = []

    for (const line of booksPO.line_items) {
      // Search CRM Product by ZB_item_id to get CRM Product ID
      let crmProductId = null
      try {
        const searchRes = await ZOHO.CRM.API.searchRecord({
          Entity: 'Products',
          Type: 'criteria',
          Query: `(ZB_item_id:equals:${line.item_id})`,
        })
        console.log('[zohoService] Product search for', line.item_id, ':', searchRes)
        if (searchRes?.data?.[0]) {
          crmProductId = searchRes.data[0].id
        }
      } catch (err) {
        console.warn('[zohoService] Product search failed for item:', line.item_id, err)
      }

      if (crmProductId) {
        productDetails.push({
          product: { id: crmProductId },
          quantity: line.quantity,
          list_price: line.rate,
          total: line.item_total,
        })
      }
    }

    if (productDetails.length > 0) {
      crmRecord.Product_Details = productDetails
    }
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
