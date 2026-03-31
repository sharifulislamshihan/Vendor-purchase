import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'

function ItemRow({ row, index, items, taxes, onUpdate, onRemove }) {
  const [open, setOpen] = useState(false)

  const handleItemSelect = (item) => {
    onUpdate(index, {
      item_id: item.item_id,
      name: item.name,
      description: item.purchase_description || '',
      rate: item.purchase_rate || 0,
      quantity: row.quantity || 1,
      tax_id: '',
      tax_percentage: 0,
    })
    setOpen(false)
  }

  const handleFieldChange = (field, value) => {
    onUpdate(index, { ...row, [field]: value })
  }

  const handleTaxChange = (taxId) => {
    const tax = taxes.find((t) => t.tax_id === taxId)
    onUpdate(index, {
      ...row,
      tax_id: taxId,
      tax_percentage: tax ? tax.tax_percentage : 0,
    })
  }

  const amount = (parseFloat(row.quantity) || 0) * (parseFloat(row.rate) || 0)
  const taxAmount = amount * ((parseFloat(row.tax_percentage) || 0) / 100)

  return (
    <tr className="border-b last:border-b-0 hover:bg-muted/20 transition-colors">
      {/* Item name — searchable dropdown */}
      <td className="p-2.5 min-w-[220px]">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger
            className={`w-full text-left h-9 text-sm px-3 border rounded-md cursor-pointer hover:bg-muted/50 transition-colors flex items-center ${
              row.name ? 'text-foreground' : 'text-muted-foreground'
            }`}
          >
            {row.name || 'Type or click to select an item'}
          </PopoverTrigger>
          <PopoverContent className="w-[300px] p-0" align="start">
            <Command>
              <CommandInput placeholder="Search items..." />
              <CommandList>
                <CommandEmpty>No items found.</CommandEmpty>
                <CommandGroup>
                  {items.map((item) => (
                    <CommandItem
                      key={item.item_id}
                      value={item.name}
                      onSelect={() => handleItemSelect(item)}
                      className="cursor-pointer"
                    >
                      <div className="flex justify-between w-full items-center">
                        <span className="text-sm font-medium">{item.name}</span>
                        <span className="text-xs text-muted-foreground ml-2">
                          {item.purchase_rate}
                        </span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        {row.name && (
          <textarea
            className="mt-1.5 w-full text-xs text-muted-foreground italic bg-muted/20 border-0 border-l-2 border-primary/20 rounded-none px-2 py-1 resize-none focus:outline-none focus:border-primary/40 placeholder:not-italic"
            rows={1}
            placeholder="Add a description"
            value={row.description || ''}
            onChange={(e) => handleFieldChange('description', e.target.value)}
          />
        )}
      </td>

      {/* Quantity */}
      <td className="p-2.5 w-[100px]">
        <Input
          type="number"
          min="1"
          className="h-9 text-sm text-right"
          value={row.quantity}
          onChange={(e) => handleFieldChange('quantity', e.target.value)}
        />
      </td>

      {/* Rate */}
      <td className="p-2.5 w-[110px]">
        <Input
          type="number"
          min="0"
          step="0.01"
          className="h-9 text-sm text-right"
          value={row.rate}
          onChange={(e) => handleFieldChange('rate', e.target.value)}
        />
      </td>

      {/* Tax */}
      <td className="p-2.5 w-[150px]">
        <Select value={row.tax_id || ''} onValueChange={handleTaxChange}>
          <SelectTrigger className="h-9 text-sm">
            {row.tax_id
              ? (() => {
                  const t = taxes.find((t) => t.tax_id === row.tax_id)
                  return t ? `${t.tax_name} (${t.tax_percentage}%)` : <SelectValue placeholder="Select Tax" />
                })()
              : <SelectValue placeholder="Select Tax" />
            }
          </SelectTrigger>
          <SelectContent>
            {taxes.map((tax) => (
              <SelectItem key={tax.tax_id} value={tax.tax_id}>
                {tax.tax_name} ({tax.tax_percentage}%)
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>

      {/* Amount */}
      <td className="p-2.5 w-[110px] text-right text-sm font-semibold tabular-nums">
        {(amount + taxAmount).toFixed(2)}
      </td>

      {/* Remove */}
      <td className="p-2.5 w-[40px]">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
          onClick={() => onRemove(index)}
        >
          ✕
        </Button>
      </td>
    </tr>
  )
}

const emptyRow = {
  item_id: '',
  name: '',
  description: '',
  quantity: 1,
  rate: 0,
  tax_id: '',
  tax_percentage: 0,
}

export default function ItemTable({ items, taxes, lineItems, onChange }) {
  const addRow = () => {
    onChange([...lineItems, { ...emptyRow }])
  }

  const updateRow = (index, updatedRow) => {
    const updated = [...lineItems]
    updated[index] = updatedRow
    onChange(updated)
  }

  const removeRow = (index) => {
    if (lineItems.length === 1) return
    onChange(lineItems.filter((_, i) => i !== index))
  }

  return (
    <div>
      {/* Table header */}
      <div className="bg-muted/60 px-2.5 py-2 border-b">
        <p className="text-sm font-semibold">Item Table</p>
      </div>

      <table className="w-full">
        <thead>
          <tr className="border-b bg-muted/30 text-xs text-muted-foreground uppercase tracking-wider">
            <th className="p-2.5 text-left font-medium">Item Details</th>
            <th className="p-2.5 text-right font-medium">Quantity</th>
            <th className="p-2.5 text-right font-medium">Rate</th>
            <th className="p-2.5 text-left font-medium">Tax</th>
            <th className="p-2.5 text-right font-medium">Amount</th>
            <th className="p-2.5 w-[40px]"></th>
          </tr>
        </thead>
        <tbody>
          {lineItems.map((row, index) => (
            <ItemRow
              key={index}
              row={row}
              index={index}
              items={items}
              taxes={taxes}
              onUpdate={updateRow}
              onRemove={removeRow}
            />
          ))}
        </tbody>
      </table>

      <div className="p-2.5 border-t bg-muted/10">
        <Button
          variant="outline"
          size="sm"
          className="text-sm text-primary border-primary/30 hover:bg-primary/5"
          onClick={addRow}
        >
          + Add New Row
        </Button>
      </div>
    </div>
  )
}
