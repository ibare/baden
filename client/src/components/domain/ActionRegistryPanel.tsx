import { useState, useCallback } from 'react';
import { Check, Trash, Plus } from '@phosphor-icons/react';
import { api } from '@/lib/api';
import type { ActionPrefix } from '@/lib/api';
import { CATEGORY_CONFIG } from '@/lib/event-types';
import { CATEGORY_COLORS } from '@/components/timeline/lib/colors';
import { PHOSPHOR_ICON_MAP } from '@/components/timeline/lib/icon-map';
import { CategorySelector } from './CategorySelector';
import { IconPicker } from './IconPicker';

interface ActionRegistryPanelProps {
  projectId: string;
  prefixes: ActionPrefix[];
  onRefresh: () => Promise<void>;
}

function CategoryBadge({ category }: { category: string }) {
  const config = CATEGORY_CONFIG[category as keyof typeof CATEGORY_CONFIG];
  const colors = CATEGORY_COLORS[category as keyof typeof CATEGORY_COLORS];
  if (!config || !colors) return <span className="text-xs">{category}</span>;
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium"
      style={{ backgroundColor: colors.fill + '22', color: colors.fill }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: colors.fill }} />
      {config.label}
    </span>
  );
}

function IconPreview({ icon }: { icon: string | null }) {
  if (!icon) return null;
  const Comp = PHOSPHOR_ICON_MAP[icon];
  if (!Comp) return <span className="text-xs text-muted-foreground">{icon}</span>;
  return <Comp size={14} weight="bold" className="text-foreground" />;
}

export function ActionRegistryPanel({
  projectId,
  prefixes,
  onRefresh,
}: ActionRegistryPanelProps) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editPrefix, setEditPrefix] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editLabel, setEditLabel] = useState('');
  const [editIcon, setEditIcon] = useState<string | null>(null);

  // New prefix form
  const [newPrefix, setNewPrefix] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newIcon, setNewIcon] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const startEdit = useCallback((p: ActionPrefix) => {
    setEditingId(p.id);
    setEditPrefix(p.prefix);
    setEditCategory(p.category);
    setEditLabel(p.label);
    setEditIcon(p.icon);
  }, []);

  const saveEdit = useCallback(async (p: ActionPrefix) => {
    if (!editCategory || !editLabel) return;
    try {
      await api.updatePrefix(projectId, p.id, {
        prefix: editPrefix,
        category: editCategory,
        label: editLabel,
        icon: editIcon,
      });
      setEditingId(null);
      await onRefresh();
    } catch (err) {
      console.error('Failed to update prefix:', err);
    }
  }, [projectId, editPrefix, editCategory, editLabel, editIcon, onRefresh]);

  const deleteHandler = useCallback(async (id: number) => {
    try {
      await api.deletePrefix(projectId, id);
      await onRefresh();
    } catch (err) {
      console.error('Failed to delete prefix:', err);
    }
  }, [projectId, onRefresh]);

  const createHandler = useCallback(async () => {
    if (!newPrefix || !newCategory || !newLabel) return;
    try {
      await api.createPrefix(projectId, {
        prefix: newPrefix,
        category: newCategory,
        label: newLabel,
        icon: newIcon,
      });
      setNewPrefix('');
      setNewCategory('');
      setNewLabel('');
      setNewIcon(null);
      setShowForm(false);
      await onRefresh();
    } catch (err) {
      console.error('Failed to create prefix:', err);
    }
  }, [projectId, newPrefix, newCategory, newLabel, newIcon, onRefresh]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
        <div>
          <h2 className="text-base font-semibold text-foreground">Action Prefixes</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            등록된 prefix {prefixes.length}개 — action의 동사 부분을 기준으로 카테고리 분류
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90"
        >
          <Plus size={14} weight="bold" />
          새 Prefix
        </button>
      </div>

      {/* New prefix form */}
      {showForm && (
        <div className="px-6 py-4 border-b border-border bg-muted/10 space-y-2">
          <div className="grid grid-cols-2 gap-2 max-w-lg">
            <input
              type="text"
              placeholder="prefix (예: add, read, fix)"
              value={newPrefix}
              onChange={(e) => setNewPrefix(e.target.value)}
              className="px-2 py-1.5 rounded-md border border-border bg-background text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <input
              type="text"
              placeholder="레이블 (예: 추가, 읽기)"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              className="px-2 py-1.5 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="max-w-lg">
            <CategorySelector value={newCategory} onChange={setNewCategory} />
          </div>
          <div className="max-w-lg">
            <IconPicker value={newIcon} onChange={setNewIcon} />
          </div>
          <div className="flex gap-2">
            <button
              onClick={createHandler}
              disabled={!newPrefix || !newCategory || !newLabel}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50"
            >
              <Plus size={12} weight="bold" />
              생성
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-2.5 py-1 rounded-md border border-border text-xs hover:bg-muted/50"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* Prefix list */}
      <div className="flex-1 overflow-y-auto">
        {prefixes.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            등록된 prefix가 없습니다
          </div>
        ) : (
          prefixes.map((p) => {
            const isEditing = editingId === p.id;

            return (
              <div key={p.id} className="flex items-start gap-3 px-6 py-3 border-b border-border/50 last:border-b-0 hover:bg-muted/20">
                <div className="flex-1 min-w-0">
                  {isEditing ? (
                    <div className="space-y-2 max-w-lg">
                      <input
                        type="text"
                        placeholder="prefix"
                        value={editPrefix}
                        onChange={(e) => setEditPrefix(e.target.value)}
                        className="w-full px-2 py-1.5 rounded-md border border-border bg-background text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      <input
                        type="text"
                        placeholder="레이블"
                        value={editLabel}
                        onChange={(e) => setEditLabel(e.target.value)}
                        className="w-full px-2 py-1.5 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      <CategorySelector value={editCategory} onChange={setEditCategory} />
                      <IconPicker value={editIcon} onChange={setEditIcon} />
                      <div className="flex gap-2">
                        <button
                          onClick={() => saveEdit(p)}
                          disabled={!editCategory || !editLabel}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50"
                        >
                          <Check size={12} weight="bold" />
                          저장
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="px-2.5 py-1 rounded-md border border-border text-xs hover:bg-muted/50"
                        >
                          취소
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded min-w-[4rem]">
                        {p.prefix}
                      </code>
                      <CategoryBadge category={p.category} />
                      <IconPreview icon={p.icon} />
                      <span className="text-xs text-muted-foreground">{p.label}</span>
                    </div>
                  )}
                </div>

                {!isEditing && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => startEdit(p)}
                      className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                      title="수정"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => deleteHandler(p.id)}
                      className="p-1 rounded hover:bg-red-100 text-muted-foreground hover:text-red-600 transition-colors"
                      title="삭제"
                    >
                      <Trash size={14} weight="bold" />
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
