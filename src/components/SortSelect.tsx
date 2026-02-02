import type { SortOption } from '../types';

interface SortSelectProps {
  value: SortOption;
  onChange: (value: SortOption) => void;
}

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'created-desc', label: '登録が新しい順' },
  { value: 'created-asc', label: '登録が古い順' },
  { value: 'name-asc', label: 'あいうえお順' },
];

export function SortSelect({ value, onChange }: SortSelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as SortOption)}
      className="w-full px-3 py-2.5 text-base font-medium rounded-lg border border-border bg-white text-text cursor-pointer hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary/30 truncate"
    >
      {SORT_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
