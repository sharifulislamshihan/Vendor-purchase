import { useState } from 'react'
import { Eye, Pencil, Trash2, AlertTriangle, FileCheck, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'

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

const PAGE_SIZES = [5, 10, 20, 50, 100]

export default function PurchaseOrderList({ vendor, purchaseOrders, loading, onCreateNew, onRefreshItems, onView, onEdit, onDelete, onConvertToBill, deleting, converting }) {
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const totalItems = purchaseOrders.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const startIndex = (safeCurrentPage - 1) * pageSize
  const paginatedOrders = purchaseOrders.slice(startIndex, startIndex + pageSize)

  const formatCurrency = (amount) => {
    const num = parseFloat(amount) || 0
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  }

  const handleDeleteClick = (po) => {
    setDeleteConfirm(po)
  }

  const handleDeleteConfirm = () => {
    if (deleteConfirm) {
      onDelete(deleteConfirm.purchaseorder_id)
      setDeleteConfirm(null)
    }
  }

  return (
    <div className="p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Purchase Orders</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {vendor?.Vendor_Name} — {purchaseOrders.length} purchase order{purchaseOrders.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-9 w-9 p-0 text-muted-foreground hover:text-primary"
            disabled={refreshing}
            onClick={async () => {
              setRefreshing(true)
              await onRefreshItems?.()
              setRefreshing(false)
            }}
            title="Refresh items from Books"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={onCreateNew} className="text-sm px-5 shadow-sm">
            + New Purchase Order
          </Button>
        </div>
      </div>

      <Separator className="mb-4" />

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="h-8 w-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm">Loading purchase orders...</p>
        </div>
      ) : purchaseOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
          </div>
          <p className="text-muted-foreground text-sm">No purchase orders yet</p>
          <Button onClick={onCreateNew} variant="outline" className="text-sm">
            Create your first purchase order
          </Button>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">PO Number</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Reference</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Total</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedOrders.map((po) => (
                <tr key={po.purchaseorder_id} className="border-b last:border-b-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(po.date)}</td>
                  <td className="px-4 py-3 font-medium">
                    <button
                      className="text-blue-600 hover:text-blue-800 hover:underline text-left font-medium"
                      onClick={() => {
                        const url = `https://books.zoho.com/app/771340721#/purchaseorders/${po.purchaseorder_id}`
                        try {
                          window.ZOHO?.CRM?.HTTP?.open({ url })
                        } catch {
                          window.open(url, '_blank')
                        }
                      }}
                    >
                      {po.purchaseorder_number}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{po.reference_number || '-'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[po.status] || 'bg-gray-100 text-gray-700'}`}>
                      {STATUS_LABELS[po.status] || po.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">
                    {po.currency_code} {formatCurrency(po.total)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
                            onClick={() => onView(po)}
                            title="View"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          {po.status !== 'billed' && po.status !== 'cancelled' && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
                                onClick={() => onEdit(po)}
                                title="Edit"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                onClick={() => handleDeleteClick(po)}
                                disabled={deleting === po.purchaseorder_id}
                                title="Delete"
                              >
                                {deleting === po.purchaseorder_id
                                  ? <div className="h-3.5 w-3.5 border-2 border-destructive/30 border-t-destructive rounded-full animate-spin" />
                                  : <Trash2 className="h-3.5 w-3.5" />
                                }
                              </Button>
                            </>
                          )}
                          {(po.status === 'open' || po.status === 'issued') && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-green-600"
                              onClick={() => onConvertToBill(po)}
                              disabled={converting === po.purchaseorder_id}
                              title="Convert to Bill"
                            >
                              {converting === po.purchaseorder_id
                                ? <div className="h-3.5 w-3.5 border-2 border-green-300 border-t-green-600 rounded-full animate-spin" />
                                : <FileCheck className="h-3.5 w-3.5" />
                              }
                            </Button>
                          )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {!loading && totalItems > 0 && (
        <div className="flex items-center justify-between mt-4 px-4 py-3 bg-muted/40 border rounded-lg">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground font-medium">Rows per page</span>
            <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setCurrentPage(1) }}>
              <SelectTrigger className="h-9 w-[75px] text-sm font-medium bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZES.map((size) => (
                  <SelectItem key={size} value={String(size)}>{size}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">
              <span className="text-foreground">{startIndex + 1}–{Math.min(startIndex + pageSize, totalItems)}</span>
              <span className="text-muted-foreground"> of </span>
              <span className="text-foreground">{totalItems}</span>
            </span>

            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-9 w-9 p-0 bg-background"
                disabled={safeCurrentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((page) => {
                  if (totalPages <= 5) return true
                  if (page === 1 || page === totalPages) return true
                  return Math.abs(page - safeCurrentPage) <= 1
                })
                .reduce((acc, page, i, arr) => {
                  if (i > 0 && page - arr[i - 1] > 1) acc.push('...')
                  acc.push(page)
                  return acc
                }, [])
                .map((page, i) =>
                  page === '...' ? (
                    <span key={`dot-${i}`} className="w-9 text-center text-muted-foreground text-sm">...</span>
                  ) : (
                    <Button
                      key={page}
                      variant={page === safeCurrentPage ? 'default' : 'outline'}
                      size="sm"
                      className={`h-9 w-9 p-0 text-sm font-medium ${page === safeCurrentPage ? '' : 'bg-background'}`}
                      onClick={() => setCurrentPage(page)}
                    >
                      {page}
                    </Button>
                  )
                )
              }

              <Button
                variant="outline"
                size="sm"
                className="h-9 w-9 p-0 bg-background"
                disabled={safeCurrentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
            <DialogTitle className="text-center">Delete Purchase Order</DialogTitle>
            <DialogDescription className="text-center">
              Are you sure you want to delete <span className="font-semibold text-foreground">{deleteConfirm?.purchaseorder_number}</span>? This will remove it from Zoho Books. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-center">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm}>
              <Trash2 className="h-4 w-4 mr-1.5" />
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
