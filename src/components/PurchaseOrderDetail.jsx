import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { ArrowLeft, Pencil, Trash2, FileCheck, Paperclip, FileText } from 'lucide-react'

const STATUS_STYLES = {
  draft: 'bg-gray-100 text-gray-700',
  open: 'bg-blue-100 text-blue-700',
  billed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
  closed: 'bg-purple-100 text-purple-700',
}

const STATUS_LABELS = {
  draft: 'Draft',
  open: 'Issued',
  billed: 'Billed',
  cancelled: 'Cancelled',
  closed: 'Closed',
}

export default function PurchaseOrderDetail({ po, attachments = [], onBack, onEdit, onDelete, onConvertToBill }) {
  const formatCurrency = (amount) => {
    const num = parseFloat(amount) || 0
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  }

  if (!po) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-3">
        <div className="h-8 w-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        <p className="text-muted-foreground text-sm">Loading purchase order...</p>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold tracking-tight">{po.purchaseorder_number}</h1>
              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[po.status] || 'bg-gray-100 text-gray-700'}`}>
                {STATUS_LABELS[po.status] || po.status}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">{po.vendor_name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {po.status !== 'billed' && po.status !== 'cancelled' && (
            <>
              <Button variant="outline" size="sm" className="text-sm" onClick={() => onEdit(po)}>
                <Pencil className="h-3.5 w-3.5 mr-1.5" />
                Edit
              </Button>
              <Button variant="outline" size="sm" className="text-sm text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30" onClick={() => onDelete(po)}>
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                Delete
              </Button>
            </>
          )}
          {(po.status === 'open' || po.status === 'issued') && (
            <Button variant="outline" size="sm" className="text-sm text-green-600 hover:text-green-700 hover:bg-green-50 border-green-300" onClick={() => onConvertToBill(po)}>
              <FileCheck className="h-3.5 w-3.5 mr-1.5" />
              Convert to Bill
            </Button>
          )}
        </div>
      </div>

      <Separator className="mb-5" />

      {/* Order Details */}
      <div className="grid grid-cols-2 gap-x-10 gap-y-3 mb-6">
        <DetailRow label="Purchase Order#" value={po.purchaseorder_number} />
        <DetailRow label="Payment Terms" value={po.payment_terms_label || '-'} />
        <DetailRow label="Reference#" value={po.reference_number || '-'} />
        <DetailRow label="Date" value={formatDate(po.date)} />
        <DetailRow label="Delivery Date" value={formatDate(po.delivery_date)} />
      </div>

      <Separator className="mb-5" />

      {/* Line Items Table */}
      <div className="border rounded-lg overflow-hidden mb-5 shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 border-b">
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">#</th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Item</th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Description</th>
              <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Qty</th>
              <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Rate</th>
              <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Tax</th>
              <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Amount</th>
            </tr>
          </thead>
          <tbody>
            {po.line_items?.map((item, i) => (
              <tr key={item.line_item_id || i} className="border-b last:border-b-0">
                <td className="px-4 py-2.5 text-muted-foreground">{i + 1}</td>
                <td className="px-4 py-2.5 font-medium">{item.name}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{item.description || '-'}</td>
                <td className="px-4 py-2.5 text-right">{item.quantity}</td>
                <td className="px-4 py-2.5 text-right">{formatCurrency(item.rate)}</td>
                <td className="px-4 py-2.5 text-right text-muted-foreground">
                  {item.tax_name ? `${item.tax_name} (${item.tax_percentage}%)` : '-'}
                </td>
                <td className="px-4 py-2.5 text-right font-semibold">{formatCurrency(item.item_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      <div className="flex gap-8 mb-6">
        {/* Notes & Terms */}
        <div className="flex-1 space-y-4">
          {po.notes && (
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Notes</p>
              <p className="text-sm bg-muted/30 border rounded-lg p-3">{po.notes}</p>
            </div>
          )}
          {po.terms && (
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Terms & Conditions</p>
              <p className="text-sm bg-muted/30 border rounded-lg p-3">{po.terms}</p>
            </div>
          )}
        </div>

        {/* Totals */}
        <div className="w-[300px] bg-muted/30 border rounded-lg p-4 space-y-2.5 self-start">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Sub Total</span>
            <span className="font-semibold">{formatCurrency(po.sub_total)}</span>
          </div>
          {parseFloat(po.discount) > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Discount</span>
              <span className="text-muted-foreground">-{formatCurrency(po.discount_total || po.discount)}</span>
            </div>
          )}
          {parseFloat(po.tax_total) > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Tax</span>
              <span>+{formatCurrency(po.tax_total)}</span>
            </div>
          )}
          {parseFloat(po.adjustment) !== 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Adjustment</span>
              <span>{formatCurrency(po.adjustment)}</span>
            </div>
          )}
          <Separator />
          <div className="flex justify-between text-base font-bold">
            <span>Total</span>
            <span className="text-primary">{po.currency_code} {formatCurrency(po.total)}</span>
          </div>
        </div>
      </div>

      {/* Attachments (read-only) */}
      {attachments.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Paperclip className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Attachments ({attachments.length})</span>
          </div>
          <div className="space-y-2">
            {attachments.map((doc) => (
              <div key={doc.document_id} className="flex items-center gap-2 px-3 py-2 bg-muted/30 border rounded-lg text-sm">
                <FileText className="h-4 w-4 text-blue-500 shrink-0" />
                <span className="truncate flex-1">{doc.file_name}</span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {doc.file_size_formatted || ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function DetailRow({ label, value }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-[130px] text-sm shrink-0 text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  )
}
