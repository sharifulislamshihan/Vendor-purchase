import { ChevronLeft, ChevronRight } from 'lucide-react'
import { DayPicker } from 'react-day-picker'
import { cn } from '@/lib/utils'

function Calendar({ className, classNames, showOutsideDays = true, ...props }) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn('p-3', className)}
      classNames={{
        months: 'flex flex-col sm:flex-row gap-2',
        month: 'flex flex-col gap-4',
        month_caption: 'flex justify-center pt-1 relative items-center h-7',
        caption_label: 'text-sm font-semibold',
        nav: 'flex items-center gap-1',
        button_previous: 'absolute left-1 top-0 inline-flex items-center justify-center rounded-md h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 transition-opacity',
        button_next: 'absolute right-1 top-0 inline-flex items-center justify-center rounded-md h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 transition-opacity',
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
      components={{
        Chevron: ({ orientation }) =>
          orientation === 'left' ? (
            <ChevronLeft className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          ),
      }}
      {...props}
    />
  )
}

Calendar.displayName = 'Calendar'

export { Calendar }
