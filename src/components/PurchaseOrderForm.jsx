import { useState, useMemo, useRef } from 'react'
import { Paperclip, X, FileText, Upload, Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DatePicker } from '@/components/ui/date-picker'
import { startOfDay } from 'date-fns'
import ItemTable from './ItemTable'

const todayStr = () => {
  const d = new Date()
  return d.toISOString().split('T')[0]
}

const beforeToday = { before: startOfDay(new Date()) }

export default function PurchaseOrderForm({ vendor, items, taxes, paymentTerms = [], defaultPaymentTerm = '', discountAccounts = [], initialPONumber, editData, existingAttachments = [], onDeleteAttachment, onSaveDraft, onSaveAndSend, onUpdate, onCancel, submitting, submitResult, onDismissResult }) {
  const isEditMode = !!editData
  const [deletingAttachment, setDeletingAttachment] = useState(null)

  const [form, setForm] = useState(() => {
    if (editData) {
      return {
        purchaseOrderNumber: editData.purchaseorder_number || '',
        reference: editData.reference_number || '',
        date: editData.date || todayStr(),
        deliveryDate: editData.delivery_date || '',
        paymentTerms: editData.payment_terms_label || defaultPaymentTerm,
        notes: editData.notes || '',
        terms: editData.terms || '',
        discount: parseFloat(editData.discount) || 0,
        discountType: editData.discount_type === 'entity_level' ? (String(editData.discount).endsWith('%') ? 'percent' : 'flat') : 'percent',
        discountAccountId: editData.discount_account_id || '',
        isDiscountBeforeTax: editData.is_discount_before_tax !== false,
        adjustment: parseFloat(editData.adjustment) || 0,
        status: editData.status || 'draft',
      }
    }
    return {
      purchaseOrderNumber: initialPONumber || '',
      reference: '',
      date: todayStr(),
      deliveryDate: '',
      paymentTerms: defaultPaymentTerm,
      notes: '',
      terms: '',
      discount: 0,
      discountType: 'percent',
      discountAccountId: '',
      isDiscountBeforeTax: true,
      adjustment: 0,
      status: 'draft',
    }
  })

  const [lineItems, setLineItems] = useState(() => {
    if (editData?.line_items?.length > 0) {
      return editData.line_items.map((li) => ({
        item_id: li.item_id || '',
        name: li.name || '',
        description: li.description || '',
        quantity: li.quantity || 1,
        rate: li.rate || 0,
        tax_id: li.tax_id || '',
        tax_name: li.tax_name || '',
        tax_percentage: li.tax_percentage || 0,
      }))
    }
    return [{ item_id: '', name: '', description: '', quantity: 1, rate: 0, tax_id: '', tax_name: '', tax_percentage: 0 }]
  })

  const [attachments, setAttachments] = useState([])
  const fileInputRef = useRef(null)

  const ALLOWED_TYPES = ['image/gif', 'image/png', 'image/jpeg', 'image/bmp', 'application/pdf',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
  const MAX_SIZE = 10 * 1024 * 1024 // 10MB

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || [])
    const valid = []
    for (const file of files) {
      if (file.size > MAX_SIZE) {
        alert(`"${file.name}" exceeds 10MB limit.`)
        continue
      }
      if (!ALLOWED_TYPES.includes(file.type)) {
        alert(`"${file.name}" is not a supported file type.`)
        continue
      }
      valid.push(file)
    }
    setAttachments((prev) => [...prev, ...valid])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removeAttachment = (index) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index))
  }

  const handleDeleteExistingAttachment = async (documentId) => {
    if (!onDeleteAttachment) return
    setDeletingAttachment(documentId)
    await onDeleteAttachment(documentId)
    setDeletingAttachment(null)
  }

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const calculations = useMemo(() => {
    let subTotal = 0
    let totalQuantity = 0

    const itemDetails = []
    lineItems.forEach((row) => {
      const qty = parseFloat(row.quantity) || 0
      const rate = parseFloat(row.rate) || 0
      const amount = qty * rate
      subTotal += amount
      totalQuantity += qty
      itemDetails.push({
        amount,
        taxPct: parseFloat(row.tax_percentage) || 0,
        taxName: row.tax_name || '',
      })
    })

    // Build per-tax-type breakdown
    const taxMap = {}
    const addTax = (taxName, taxPct, taxAmt) => {
      const key = `${taxName}__${taxPct}`
      if (taxMap[key]) {
        taxMap[key].amount += taxAmt
      } else {
        taxMap[key] = { taxName: taxName || `Tax ${taxPct}%`, taxPct, amount: taxAmt }
      }
    }

    const discountInput = parseFloat(form.discount) || 0
    let discountAmount = 0
    let totalTax = 0

    if (form.isDiscountBeforeTax) {
      // DISCOUNT BEFORE TAX: discount on subtotal, then tax on discounted amounts
      discountAmount = form.discountType === 'percent'
        ? subTotal * (discountInput / 100)
        : discountInput

      itemDetails.forEach(({ amount, taxPct, taxName }) => {
        if (taxPct <= 0) return
        const itemDiscount = subTotal > 0 ? discountAmount * (amount / subTotal) : 0
        addTax(taxName, taxPct, (amount - itemDiscount) * (taxPct / 100))
      })
    } else {
      // TAX BEFORE DISCOUNT: tax on full amounts first
      itemDetails.forEach(({ amount, taxPct, taxName }) => {
        if (taxPct <= 0) return
        addTax(taxName, taxPct, amount * (taxPct / 100))
      })

      // For percentage: discount on (subtotal + tax); for flat: just the flat amount
      const taxTotal = Object.values(taxMap).reduce((s, t) => s + t.amount, 0)
      discountAmount = form.discountType === 'percent'
        ? (subTotal + taxTotal) * (discountInput / 100)
        : discountInput
    }

    const taxBreakdown = Object.values(taxMap)
    totalTax = taxBreakdown.reduce((s, t) => s + t.amount, 0)
    const adjustment = parseFloat(form.adjustment) || 0
    const total = subTotal + totalTax - discountAmount + adjustment

    return { subTotal, totalTax, totalQuantity, discountAmount, adjustment, total, taxBreakdown }
  }, [lineItems, form.discount, form.discountType, form.adjustment, form.isDiscountBeforeTax])

  const [validationErrors, setValidationErrors] = useState([])

  const handleSubmit = (action) => {
    const errors = []
    if (!vendor?.Books_Contact_ID) {
      errors.push('This vendor is not linked to Zoho Books. Please link the vendor first.')
    }
    if (!form.date) {
      errors.push('Date is required.')
    }
    const validItems = lineItems.filter((row) => row.item_id)
    if (validItems.length === 0) {
      errors.push('Add at least one item to the purchase order.')
    }

    const discountVal = parseFloat(form.discount) || 0
    if (discountVal > 0 && !form.discountAccountId) {
      errors.push('Please select a Discount Account.')
    }

    if (errors.length > 0) {
      setValidationErrors(errors)
      return
    }
    setValidationErrors([])

    const payload = {
      ...form,
      purchaseOrderNumber: form.purchaseOrderNumber,
      vendor_id: vendor?.Books_Contact_ID,
      line_items: validItems,
      attachments,
      ...calculations,
    }
    console.log('[PurchaseOrderForm] Submit:', action, payload)

    if (isEditMode) {
      onUpdate?.(payload)
    } else if (action === 'draft') {
      onSaveDraft?.(payload)
    } else {
      onSaveAndSend?.(payload)
    }
  }

  return (
    <div className="max-w-5xl mx-auto p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight">{isEditMode ? 'Edit Purchase Order' : 'New Purchase Order'}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isEditMode
              ? <>Editing <span className="font-semibold text-foreground">{editData?.purchaseorder_number}</span> for <span className="font-semibold text-foreground">{vendor?.Vendor_Name}</span></>
              : <>Create a purchase order for <span className="font-semibold text-foreground">{vendor?.Vendor_Name}</span></>
            }
          </p>
        </div>
        <div className="bg-primary/5 border border-primary/15 rounded-lg px-5 py-3">
          <p className="text-xs text-muted-foreground">Vendor</p>
          <p className="text-lg font-bold text-primary tracking-tight">{vendor?.Vendor_Name}</p>
        </div>
      </div>

      <Separator className="mb-5" />

      {/* Order Details — 2 column grid */}
      <div className="grid grid-cols-2 gap-x-10 gap-y-3.5 mb-6">
        <div className="flex items-center gap-3">
          <Label className="w-[130px] text-sm shrink-0 text-muted-foreground">Purchase Order#</Label>
          <Input
            className="h-9 text-sm"
            placeholder="Auto-generated"
            value={form.purchaseOrderNumber}
            onChange={(e) => updateField('purchaseOrderNumber', e.target.value)}
            readOnly={isEditMode}
          />
        </div>

        <div className="flex items-center gap-3">
          <Label className="w-[130px] text-sm shrink-0 text-muted-foreground">Payment Terms</Label>
          <Select value={form.paymentTerms} onValueChange={(v) => updateField('paymentTerms', v)}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {paymentTerms.map((term) => (
                <SelectItem key={term.payment_terms_id} value={term.payment_terms_label}>
                  {term.payment_terms_label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-3">
          <Label className="w-[130px] text-sm shrink-0 text-muted-foreground">Reference#</Label>
          <Input
            className="h-9 text-sm"
            value={form.reference}
            onChange={(e) => updateField('reference', e.target.value)}
          />
        </div>

        <div className="flex items-center gap-3">
          <Label className="w-[130px] text-sm shrink-0 text-muted-foreground">Date</Label>
          <DatePicker
            value={form.date}
            onChange={(v) => updateField('date', v)}
            placeholder="Select date"
            disabledDays={isEditMode ? undefined : beforeToday}
            className="h-9 text-sm w-full"
          />
        </div>

        <div className="flex items-center gap-3">
          <Label className="w-[130px] text-sm shrink-0 text-muted-foreground">Delivery Date</Label>
          <DatePicker
            value={form.deliveryDate}
            onChange={(v) => updateField('deliveryDate', v)}
            placeholder="Select delivery date"
            disabledDays={isEditMode ? undefined : beforeToday}
            className="h-9 text-sm w-full"
          />
        </div>

        {isEditMode && (
          <div className="flex items-center gap-3">
            <Label className="w-[130px] text-sm shrink-0 text-muted-foreground">Status</Label>
            {editData?.status === 'open' || editData?.status === 'issued' ? (
              <span className="text-sm font-medium text-blue-600">Issued</span>
            ) : (
              <Select value={form.status} onValueChange={(v) => updateField('status', v)}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="open">Issued</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        )}
      </div>

      <Separator className="mb-5" />

      {/* Item Table */}
      <div className="border rounded-lg overflow-hidden mb-5 shadow-sm">
        <ItemTable
          items={items}
          taxes={taxes}
          lineItems={lineItems}
          onChange={setLineItems}
        />
      </div>

      {/* Summary Section */}
      <div className="flex gap-8 mb-6">
        {/* Notes & Terms */}
        <div className="flex-1 space-y-4">
          <div>
            <Label className="text-sm text-muted-foreground mb-1.5 block">Notes</Label>
            <Textarea
              className="text-sm min-h-[80px] resize-none"
              placeholder="Will be displayed on purchase order"
              value={form.notes}
              onChange={(e) => updateField('notes', e.target.value)}
            />
          </div>
          <div>
            <Label className="text-sm text-muted-foreground mb-1.5 block">Terms & Conditions</Label>
            <Textarea
              className="text-sm min-h-[80px] resize-none"
              placeholder="Enter terms and conditions"
              value={form.terms}
              onChange={(e) => updateField('terms', e.target.value)}
            />
          </div>

        </div>

        {/* Totals Card */}
        <div className="w-[340px] bg-muted/30 border rounded-lg p-4 space-y-3 self-start">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Sub Total</span>
            <span className="font-semibold">{calculations.subTotal.toFixed(2)}</span>
          </div>
          <div className="text-xs text-muted-foreground">
            Total Quantity: {calculations.totalQuantity}
          </div>

          {/* --- BEFORE DISCOUNT mode: Tax then Discount --- */}
          {!form.isDiscountBeforeTax && calculations.taxBreakdown.length > 0 && (
            <div className="border rounded-md px-3 py-2.5 space-y-1.5 bg-background">
              {calculations.taxBreakdown.map((t, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-blue-600">{t.taxName} [{t.taxPct}%]</span>
                  <span>{t.amount.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Discount */}
          <div className="flex items-center justify-between text-sm">
            <div>
              <span className="text-muted-foreground">Discount</span>
              {parseFloat(form.discount) > 0 && (
                <button
                  type="button"
                  className="block text-xs text-blue-500 hover:text-blue-700 hover:underline transition-colors mt-0.5"
                  onClick={() => updateField('isDiscountBeforeTax', !form.isDiscountBeforeTax)}
                >
                  {form.isDiscountBeforeTax ? 'Apply after tax' : 'Apply before tax'}
                </button>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <Input
                type="number"
                min="0"
                className="h-8 w-[65px] text-sm text-right"
                value={form.discount}
                onChange={(e) => updateField('discount', e.target.value)}
              />
              <div className="flex h-8 rounded-md border overflow-hidden">
                <button
                  type="button"
                  className={`px-2.5 text-xs font-medium transition-colors ${
                    form.discountType === 'percent'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-background text-muted-foreground hover:bg-muted/50'
                  }`}
                  onClick={() => updateField('discountType', 'percent')}
                >
                  %
                </button>
                <button
                  type="button"
                  className={`px-2.5 text-xs font-medium border-l transition-colors ${
                    form.discountType === 'flat'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-background text-muted-foreground hover:bg-muted/50'
                  }`}
                  onClick={() => updateField('discountType', 'flat')}
                >
                  Flat
                </button>
              </div>
              <span className="w-[65px] text-right text-muted-foreground">-{calculations.discountAmount.toFixed(2)}</span>
            </div>
          </div>

          {/* Discount Account — shown when discount > 0 and at least one item added */}
          {parseFloat(form.discount) > 0 && lineItems.some((r) => r.item_id) && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-destructive font-medium">Discount Account*</span>
              <Select value={form.discountAccountId} onValueChange={(v) => updateField('discountAccountId', v)}>
                <SelectTrigger className="h-8 w-[220px] text-sm">
                  <SelectValue placeholder="Select an account">
                    {discountAccounts.find((a) => a.account_id === form.discountAccountId)?.account_name || 'Select an account'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {discountAccounts.map((acc) => (
                    <SelectItem key={acc.account_id} value={acc.account_id}>
                      {acc.account_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* --- AFTER DISCOUNT mode: Discount then Tax --- */}
          {form.isDiscountBeforeTax && calculations.taxBreakdown.length > 0 && (
            <div className="border rounded-md px-3 py-2.5 space-y-1.5 bg-background">
              {calculations.taxBreakdown.map((t, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-blue-600">{t.taxName} [{t.taxPct}%]</span>
                  <span>{t.amount.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Adjustment */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Adjustment</span>
            <Input
              type="number"
              className="h-8 w-[110px] text-sm text-right"
              value={form.adjustment}
              onChange={(e) => updateField('adjustment', e.target.value)}
            />
          </div>

          <Separator />

          <div className="flex justify-between text-base font-bold">
            <span>Total</span>
            <span className="text-primary">{calculations.total.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Attachments */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Paperclip className="h-4 w-4 text-muted-foreground" />
          <Label className="text-sm font-medium">Attach File(s) to Purchase Order</Label>
        </div>

        {/* Existing attachments (from Books) */}
        {existingAttachments.length > 0 && (
          <div className="mb-3 space-y-2">
            {existingAttachments.map((doc) => (
              <div key={doc.document_id} className="flex items-center gap-2 px-3 py-2 bg-blue-50/50 border border-blue-200/50 rounded-lg text-sm">
                <FileText className="h-4 w-4 text-blue-500 shrink-0" />
                <span className="truncate flex-1">{doc.file_name}</span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {doc.file_size_formatted || ''}
                </span>
                {isEditMode && (
                  <button
                    type="button"
                    className="text-destructive/60 hover:text-destructive transition-colors shrink-0"
                    disabled={deletingAttachment === doc.document_id}
                    onClick={() => handleDeleteExistingAttachment(doc.document_id)}
                  >
                    {deletingAttachment === doc.document_id
                      ? <div className="h-3.5 w-3.5 border-2 border-destructive/30 border-t-destructive rounded-full animate-spin" />
                      : <Trash2 className="h-3.5 w-3.5" />
                    }
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Upload new files */}
        <div className="flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".gif,.png,.jpg,.jpeg,.bmp,.pdf,.xls,.xlsx,.doc,.docx"
            onChange={handleFileSelect}
            className="hidden"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-sm gap-1.5"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-3.5 w-3.5" />
            Upload File
          </Button>
          <span className="text-xs text-muted-foreground">Max 10MB per file. Supported: PDF, DOC, XLS, JPG, PNG</span>
        </div>

        {/* New attachments (not yet uploaded) */}
        {attachments.length > 0 && (
          <div className="mt-3 space-y-2">
            {attachments.map((file, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-2 bg-muted/30 border rounded-lg text-sm">
                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="truncate flex-1">{file.name}</span>
                <span className="text-xs text-muted-foreground shrink-0">{(file.size / 1024).toFixed(0)} KB</span>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                  onClick={() => removeAttachment(i)}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Separator className="mb-4" />

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <div className="mb-4 px-4 py-3 rounded-lg text-sm bg-amber-50 text-amber-700 border border-amber-200">
          <ul className="list-disc list-inside space-y-0.5">
            {validationErrors.map((err, i) => <li key={i}>{err}</li>)}
          </ul>
        </div>
      )}

      {/* Submit Result */}
      {submitResult && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm flex items-center justify-between ${
          submitResult.type === 'success'
            ? 'bg-green-50 text-green-700 border border-green-200'
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          <span>{submitResult.message}</span>
          <button
            className="ml-3 text-current opacity-50 hover:opacity-100 transition-opacity"
            onClick={() => onDismissResult?.()}
          >
            ✕
          </button>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center gap-3">
        {isEditMode ? (
          <>
            <Button
              className="text-sm px-5 bg-primary hover:bg-primary/90 shadow-sm"
              disabled={submitting}
              onClick={() => handleSubmit('update')}
            >
              {submitting ? 'Updating...' : 'Update Purchase Order'}
            </Button>
            <Button
              variant="ghost"
              className="text-sm text-muted-foreground"
              disabled={submitting}
              onClick={onCancel}
            >
              Cancel
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="outline"
              className="text-sm px-5"
              disabled={submitting}
              onClick={() => handleSubmit('draft')}
            >
              {submitting === 'draft' ? 'Saving...' : 'Save as Draft'}
            </Button>
            <Button
              className="text-sm px-5 bg-primary hover:bg-primary/90 shadow-sm"
              disabled={submitting}
              onClick={() => handleSubmit('send')}
            >
              {submitting === 'send' ? 'Saving...' : 'Save and Send'}
            </Button>
            <Button
              variant="ghost"
              className="text-sm text-muted-foreground"
              disabled={submitting}
              onClick={onCancel}
            >
              Cancel
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
