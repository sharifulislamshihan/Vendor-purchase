import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { DayPicker } from 'react-day-picker'
import { cn } from '@/lib/utils'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function Calendar({ className, classNames, showOutsideDays = true, ...props }) {
  const today = new Date()
  const initMonth = props.defaultMonth || props.selected || today
  const [month, setMonth] = useState(initMonth)

  const handleMonthChange = (e) => {
    const newMonth = new Date(month)
    newMonth.setMonth(parseInt(e.target.value, 10))
    setMonth(newMonth)
  }

  const handleYearChange = (e) => {
    const newMonth = new Date(month)
    newMonth.setFullYear(parseInt(e.target.value, 10))
    setMonth(newMonth)
  }

  const goToPrevMonth = () => {
    const prev = new Date(month)
    prev.setMonth(prev.getMonth() - 1)
    setMonth(prev)
  }

  const goToNextMonth = () => {
    const next = new Date(month)
    next.setMonth(next.getMonth() + 1)
    setMonth(next)
  }

  // Generate year range: 5 years back to 5 years forward
  const currentYear = today.getFullYear()
  const years = []
  for (let y = currentYear - 5; y <= currentYear + 5; y++) {
    years.push(y)
  }

  return (
    <div className={cn('p-3', className)}>
      {/* Custom header with dropdowns */}
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={goToPrevMonth}
          className="inline-flex items-center justify-center rounded-md h-8 w-8 hover:bg-muted active:bg-muted/80 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-1.5">
          <select
            value={month.getMonth()}
            onChange={handleMonthChange}
            className="text-sm font-semibold bg-transparent border border-border rounded-md px-2 py-1 cursor-pointer hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {MONTHS.map((name, i) => (
              <option key={i} value={i}>{name}</option>
            ))}
          </select>

          <select
            value={month.getFullYear()}
            onChange={handleYearChange}
            className="text-sm font-semibold bg-transparent border border-border rounded-md px-2 py-1 cursor-pointer hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={goToNextMonth}
          className="inline-flex items-center justify-center rounded-md h-8 w-8 hover:bg-muted active:bg-muted/80 transition-colors"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Day grid only — hide DayPicker's built-in nav */}
      <DayPicker
        showOutsideDays={showOutsideDays}
        month={month}
        onMonthChange={setMonth}
        hideNavigation
        classNames={{
          months: 'flex flex-col',
          month: 'flex flex-col',
          month_caption: 'hidden',
          month_grid: 'w-full border-collapse',
          weekdays: 'flex',
          weekday: 'text-muted-foreground rounded-md w-9 font-medium text-[0.8rem] flex items-center justify-center',
          week: 'flex w-full mt-1',
          day: 'relative p-0 text-center text-sm focus-within:relative',
          day_button: cn(
            'inline-flex items-center justify-center rounded-md h-9 w-9 p-0 font-normal transition-colors',
            'hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
          ),
          selected: 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground rounded-md',
          today: 'bg-accent text-accent-foreground font-semibold rounded-md',
          outside: 'text-muted-foreground/40',
          disabled: 'text-muted-foreground/30 cursor-not-allowed hover:bg-transparent',
          hidden: 'invisible',
          ...classNames,
        }}
        {...props}
      />
    </div>
  )
}

Calendar.displayName = 'Calendar'

export { Calendar }
