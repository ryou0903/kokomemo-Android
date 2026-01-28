import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
} from 'date-fns';
import { ja } from 'date-fns/locale';
import type { Place } from '../types';
import { getPlaces } from '../lib/storage';
import { Header } from '../components/layout/Header';
import { Button, Loading } from '../components/ui';
import { PlaceCard } from '../components/PlaceCard';

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

export function CalendarPage() {
  const navigate = useNavigate();
  const [places, setPlaces] = useState<Place[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setPlaces(getPlaces());
    setIsLoading(false);
  }, []);

  // Get dates with places registered
  const datesWithPlaces = useMemo(() => {
    const dates = new Map<string, Place[]>();
    places.forEach((place) => {
      const dateKey = format(new Date(place.createdAt), 'yyyy-MM-dd');
      const existing = dates.get(dateKey) || [];
      dates.set(dateKey, [...existing, place]);
    });
    return dates;
  }, [places]);

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentMonth]);

  // Places for selected date
  const selectedDatePlaces = useMemo(() => {
    if (!selectedDate) return [];
    const dateKey = format(selectedDate, 'yyyy-MM-dd');
    return datesWithPlaces.get(dateKey) || [];
  }, [selectedDate, datesWithPlaces]);

  const handlePrevMonth = useCallback(() => {
    setCurrentMonth((prev) => subMonths(prev, 1));
    setSelectedDate(null);
  }, []);

  const handleNextMonth = useCallback(() => {
    setCurrentMonth((prev) => addMonths(prev, 1));
    setSelectedDate(null);
  }, []);

  const handleDateClick = useCallback((date: Date) => {
    setSelectedDate((prev) => (prev && isSameDay(prev, date) ? null : date));
  }, []);

  const handleEditPlace = useCallback(
    (place: Place) => {
      navigate(`/place/${place.id}`);
    },
    [navigate]
  );

  if (isLoading) {
    return <Loading fullScreen message="読み込み中..." />;
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="📅 カレンダー" showBack />

      <main className="flex-1 flex flex-col">
        {/* Month navigation */}
        <div className="flex items-center justify-between px-4 py-4 bg-surface border-b border-border">
          <Button variant="secondary" onClick={handlePrevMonth}>
            ◀ 前の月
          </Button>
          <h2 className="text-xl font-bold text-text">
            {format(currentMonth, 'yyyy年M月', { locale: ja })}
          </h2>
          <Button variant="secondary" onClick={handleNextMonth}>
            次の月 ▶
          </Button>
        </div>

        {/* Calendar grid */}
        <div className="bg-surface">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 border-b border-border">
            {WEEKDAYS.map((day, index) => (
              <div
                key={day}
                className={`
                  py-2 text-center text-base font-bold
                  ${index === 0 ? 'text-danger' : ''}
                  ${index === 6 ? 'text-primary' : ''}
                  ${index > 0 && index < 6 ? 'text-text-secondary' : ''}
                `}
              >
                {day}
              </div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7">
            {calendarDays.map((day) => {
              const dateKey = format(day, 'yyyy-MM-dd');
              const hasPlaces = datesWithPlaces.has(dateKey);
              const isSelected = selectedDate && isSameDay(day, selectedDate);
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const isToday = isSameDay(day, new Date());
              const dayOfWeek = day.getDay();

              return (
                <button
                  key={dateKey}
                  onClick={() => handleDateClick(day)}
                  className={`
                    relative aspect-square flex flex-col items-center justify-center
                    text-lg font-medium transition-colors border-b border-r border-border
                    ${!isCurrentMonth ? 'text-text-secondary/40' : ''}
                    ${isCurrentMonth && dayOfWeek === 0 ? 'text-danger' : ''}
                    ${isCurrentMonth && dayOfWeek === 6 ? 'text-primary' : ''}
                    ${isSelected ? 'bg-primary/10' : ''}
                    ${isToday ? 'font-bold' : ''}
                    hover:bg-gray-50
                  `}
                >
                  <span
                    className={`
                      w-8 h-8 flex items-center justify-center rounded-full
                      ${isToday ? 'bg-primary text-white' : ''}
                    `}
                  >
                    {format(day, 'd')}
                  </span>
                  {hasPlaces && (
                    <span className="absolute bottom-1 w-2 h-2 rounded-full bg-success" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected date places */}
        {selectedDate && (
          <div className="flex-1 px-4 py-4">
            <h3 className="text-lg font-bold text-text mb-4">
              {format(selectedDate, 'M月d日（E）', { locale: ja })}に登録した場所
            </h3>
            {selectedDatePlaces.length === 0 ? (
              <p className="text-center text-text-secondary py-8">
                この日に登録した場所はありません
              </p>
            ) : (
              <div className="flex flex-col gap-4">
                {selectedDatePlaces.map((place) => (
                  <PlaceCard key={place.id} place={place} onEdit={handleEditPlace} />
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
