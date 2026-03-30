import { useState, useMemo } from 'react'
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
import ItemTable from './ItemTable'

const PAYMENT_TERMS = [
  'Due on Receipt',
  'Net 15',
  'Net 30',
  'Net 45',
  'Net 60',
  'Due end of the month',
]

const todayStr = () => {
  const d = new Date()
  return d.toISOString().split('T')[0]
}

export default function PurchaseOrderForm({ vendor, items, taxes, initialPONumber, onSaveDraft, onSaveAndSend, onCancel, submitting, submitResult }) {
  const [form, setForm] = useState({
    purchaseOrderNumber: initialPONumber || '',
    reference: '',
    date: todayStr(),
    deliveryDate: '',
    paymentTerms: 'Due on Receipt',
    notes: '',
    terms: '',
    discount: 0,
    discountType: 'percent',
    adjustment: 0,
  })

  const [lineItems, setLineItems] = useState([
    { item_id: '', name: '', description: '', quantity: 1, rate: 0, tax_id: '', tax_percentage: 0 },
  ])

  // Use initialPONumber as default if user hasn't typed anything
  const displayPONumber = form.purchaseOrderNumber || initialPONumber || ''

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const calculations = useMemo(() => {
    let subTotal = 0
    let totalTax = 0
    let totalQuantity = 0

    lineItems.forEach((row) => {
      const qty = parseFloat(row.quantity) || 0
      const rate = parseFloat(row.rate) || 0
      const amount = qty * rate
      const tax = amount * ((parseFloat(row.tax_percentage) || 0) / 100)
      subTotal += amount
      totalTax += tax
      totalQuantity += qty
    })

    let discountAmount = 0
    if (form.discountType === 'percent') {
      discountAmount = subTotal * ((parseFloat(form.discount) || 0) / 100)
    } else {
      discountAmount = parseFloat(form.discount) || 0
    }

    const adjustment = parseFloat(form.adjustment) || 0
    const total = subTotal + totalTax - discountAmount + adjustment

    return { subTotal, totalTax, totalQuantity, discountAmount, adjustment, total }
  }, [lineItems, form.discount, form.discountType, form.adjustment])

  const handleSubmit = (action) => {
    const payload = {
      ...form,
      purchaseOrderNumber: displayPONumber,
      vendor_id: vendor?.Books_Contact_ID,
      line_items: lineItems.filter((row) => row.item_id),
      ...calculations,
    }
    console.log('[PurchaseOrderForm] Submit:', action, payload)

    if (action === 'draft') {
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
          <h1 className="text-xl font-bold tracking-tight">New Purchase Order</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Create a purchase order for <span className="font-semibold text-foreground">{vendor?.Vendor_Name}</span></p>
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
            value={displayPONumber}
            onChange={(e) => updateField('purchaseOrderNumber', e.target.value)}
          />
        </div>

        <div className="flex items-center gap-3">
          <Label className="w-[130px] text-sm shrink-0 text-muted-foreground">Payment Terms</Label>
          <Select value={form.paymentTerms} onValueChange={(v) => updateField('paymentTerms', v)}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAYMENT_TERMS.map((term) => (
                <SelectItem key={term} value={term}>
                  {term}
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
          <Input
            type="date"
            className="h-9 text-sm"
            value={form.date}
            onChange={(e) => updateField('date', e.target.value)}
          />
        </div>

        <div className="flex items-center gap-3">
          <Label className="w-[130px] text-sm shrink-0 text-muted-foreground">Delivery Date</Label>
          <Input
            type="date"
            className="h-9 text-sm"
            value={form.deliveryDate}
            onChange={(e) => updateField('deliveryDate', e.target.value)}
          />
        </div>
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

          {/* Attachment */}
          <div>
            <Label className="text-sm text-muted-foreground mb-1.5 block">Attach File(s) to Purchase Order</Label>
            <label className="flex items-center gap-2 border border-dashed rounded-lg px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              <span className="text-sm text-muted-foreground">Upload File</span>
              <input
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  const files = Array.from(e.target.files || [])
                  console.log('[PurchaseOrderForm] Files selected:', files.map(f => f.name))
                  setForm((prev) => ({ ...prev, attachments: [...(prev.attachments || []), ...files] }))
                }}
              />
            </label>
            {form.attachments?.length > 0 && (
              <div className="mt-2 space-y-1">
                {form.attachments.map((file, i) => (
                  <div key={i} className="flex items-center justify-between text-xs bg-muted/30 rounded px-2 py-1">
                    <span className="text-foreground truncate">{file.name}</span>
                    <button
                      className="text-muted-foreground hover:text-destructive ml-2"
                      onClick={() => setForm((prev) => ({
                        ...prev,
                        attachments: prev.attachments.filter((_, idx) => idx !== i),
                      }))}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Max 10 files, 10MB each</p>
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

          {/* Discount */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Discount</span>
            <div className="flex items-center gap-1">
              <Input
                type="number"
                min="0"
                className="h-8 w-[65px] text-sm text-right"
                value={form.discount}
                onChange={(e) => updateField('discount', e.target.value)}
              />
              <Select value={form.discountType} onValueChange={(v) => updateField('discountType', v)}>
                <SelectTrigger className="h-8 w-[55px] text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">%</SelectItem>
                  <SelectItem value="flat">Flat</SelectItem>
                </SelectContent>
              </Select>
              <span className="w-[65px] text-right text-muted-foreground">-{calculations.discountAmount.toFixed(2)}</span>
            </div>
          </div>

          {/* Tax */}
          {calculations.totalTax > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Tax</span>
              <span>+{calculations.totalTax.toFixed(2)}</span>
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

      <Separator className="mb-4" />

      {/* Submit Result */}
      {submitResult && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm ${
          submitResult.type === 'success'
            ? 'bg-green-50 text-green-700 border border-green-200'
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {submitResult.message}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          className="text-sm px-5"
          disabled={submitting}
          onClick={() => handleSubmit('draft')}
        >
          {submitting ? 'Saving...' : 'Save as Draft'}
        </Button>
        <Button
          className="text-sm px-5 bg-primary hover:bg-primary/90 shadow-sm"
          disabled={submitting}
          onClick={() => handleSubmit('send')}
        >
          {submitting ? 'Saving...' : 'Save and Send'}
        </Button>
        <Button
          variant="ghost"
          className="text-sm text-muted-foreground"
          disabled={submitting}
          onClick={onCancel}
        >
          Cancel
        </Button>
      </div>
    </div>
  )
}
