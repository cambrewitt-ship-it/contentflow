'use client';

interface WeekDayChooserProps {
  weekStart: Date;
  selectedDateKey: string | null;
  onSelect: (dateKey: string) => void;
  disabled?: boolean;
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function toDateKey(date: Date): string {
  return date.toLocaleDateString('en-CA');
}

export function WeekDayChooser({ weekStart, selectedDateKey, onSelect, disabled }: WeekDayChooserProps) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + i);
    return { date, dateKey: toDateKey(date), label: DAY_LABELS[i] };
  });

  return (
    <div className="grid grid-cols-7 gap-1.5">
      {days.map(({ date, dateKey, label }) => {
        const isSelected = dateKey === selectedDateKey;
        return (
          <button
            key={dateKey}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(dateKey)}
            className={`flex flex-col items-center justify-center py-2 rounded-lg border text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              isSelected
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
            }`}
          >
            <span>{label}</span>
            <span className="text-[11px] opacity-80">{date.getDate()}</span>
          </button>
        );
      })}
    </div>
  );
}
