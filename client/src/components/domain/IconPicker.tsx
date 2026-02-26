import { useState, useMemo, useRef, useEffect } from 'react';
import { PHOSPHOR_ICON_MAP, ICON_NAMES } from '@/components/timeline/lib/icon-map';

interface IconPickerProps {
  value: string | null;
  onChange: (icon: string | null) => void;
}

const PAGE_SIZE = 80;

export function IconPicker({ value, onChange }: IconPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  // Reset page on search change
  useEffect(() => { setPage(0); }, [search]);

  const filtered = useMemo(() => {
    if (!search) return ICON_NAMES;
    const q = search.toLowerCase();
    return ICON_NAMES.filter((name) => name.toLowerCase().includes(q));
  }, [search]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const visible = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const SelectedIcon = value ? PHOSPHOR_ICON_MAP[value] : null;

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => { setOpen(!open); setSearch(''); }}
        className="flex items-center gap-2 px-2 py-1.5 rounded-md border border-border bg-background text-sm hover:bg-muted/50 transition-colors w-full"
      >
        {SelectedIcon ? (
          <>
            <SelectedIcon size={16} weight="bold" />
            <span className="truncate">{value}</span>
          </>
        ) : (
          <span className="text-muted-foreground">아이콘 선택</span>
        )}
      </button>

      {open && (
        <div className="absolute z-50 top-full left-0 mt-1 w-80 bg-popover border border-border rounded-lg shadow-xl overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b border-border">
            <input
              ref={inputRef}
              type="text"
              placeholder="아이콘 이름으로 검색 (예: Shield, Brain, Code...)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-2 py-1 rounded border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              autoFocus
            />
            <div className="flex items-center justify-between mt-1.5 text-[10px] text-muted-foreground">
              <span>{filtered.length}개 아이콘</span>
              {value && (
                <button
                  type="button"
                  onClick={() => { onChange(null); setOpen(false); }}
                  className="text-red-500 hover:underline"
                >
                  선택 해제
                </button>
              )}
            </div>
          </div>

          {/* Icon grid */}
          <div className="grid grid-cols-10 gap-0.5 p-2 max-h-56 overflow-y-auto">
            {visible.map((name) => {
              const Icon = PHOSPHOR_ICON_MAP[name];
              if (!Icon) return null;
              const isSelected = value === name;
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => { onChange(name); setOpen(false); }}
                  className={`flex items-center justify-center w-7 h-7 rounded transition-colors ${
                    isSelected
                      ? 'bg-primary/20 ring-1 ring-primary'
                      : 'hover:bg-muted/50'
                  }`}
                  title={name}
                >
                  <Icon size={15} weight="bold" />
                </button>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 px-2 py-1.5 border-t border-border text-[10px] text-muted-foreground">
              <button
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
                className="px-1.5 py-0.5 rounded border border-border hover:bg-muted/50 disabled:opacity-30"
              >
                이전
              </button>
              <span>{page + 1} / {totalPages}</span>
              <button
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
                className="px-1.5 py-0.5 rounded border border-border hover:bg-muted/50 disabled:opacity-30"
              >
                다음
              </button>
            </div>
          )}

          {filtered.length === 0 && (
            <div className="p-3 text-center text-xs text-muted-foreground">
              검색 결과 없음
            </div>
          )}
        </div>
      )}
    </div>
  );
}
