import { useState, useEffect, useCallback } from 'react';
import type { Tab } from '../types';
import { getTabs, getCustomTabs, addCustomTab, updateTab, deleteTab } from '../lib/storage';
import { Header } from '../components/layout/Header';
import { Button, Input, Card, ConfirmDialog } from '../components/ui';
import { useToast } from '../contexts/ToastContext';

export function TabsPage() {
  const { showToast } = useToast();
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [customTabs, setCustomTabs] = useState<Tab[]>([]);
  const [newTabName, setNewTabName] = useState('');
  const [editingTab, setEditingTab] = useState<Tab | null>(null);
  const [editName, setEditName] = useState('');
  const [deleteTabTarget, setDeleteTabTarget] = useState<Tab | null>(null);

  const loadTabs = useCallback(() => {
    setTabs(getTabs());
    setCustomTabs(getCustomTabs());
  }, []);

  useEffect(() => {
    loadTabs();
  }, [loadTabs]);

  const handleAddTab = useCallback(() => {
    if (!newTabName.trim()) {
      showToast('カテゴリ名を入力してください', 'error');
      return;
    }

    if (customTabs.length >= 5) {
      showToast('カテゴリは5つまでしか作成できません', 'error');
      return;
    }

    const newTab = addCustomTab(newTabName.trim());
    if (newTab) {
      setNewTabName('');
      loadTabs();
      showToast('カテゴリを追加しました');
    } else {
      showToast('カテゴリの追加に失敗しました', 'error');
    }
  }, [newTabName, customTabs.length, loadTabs, showToast]);

  const handleStartEdit = useCallback((tab: Tab) => {
    setEditingTab(tab);
    setEditName(tab.name);
  }, []);

  const handleSaveEdit = useCallback(() => {
    if (!editingTab) return;

    if (!editName.trim()) {
      showToast('カテゴリ名を入力してください', 'error');
      return;
    }

    const updated = updateTab(editingTab.id, editName.trim());
    if (updated) {
      setEditingTab(null);
      setEditName('');
      loadTabs();
      showToast('カテゴリ名を変更しました');
    } else {
      showToast('変更に失敗しました', 'error');
    }
  }, [editingTab, editName, loadTabs, showToast]);

  const handleDeleteTab = useCallback(() => {
    if (!deleteTabTarget) return;

    const success = deleteTab(deleteTabTarget.id);
    if (success) {
      setDeleteTabTarget(null);
      loadTabs();
      showToast('カテゴリを削除しました');
    } else {
      showToast('削除に失敗しました', 'error');
    }
  }, [deleteTabTarget, loadTabs, showToast]);

  const defaultTabs = tabs.filter((t) => !t.isCustom && t.id !== 'all');

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="カテゴリの管理" showBack />

      <main className="flex-1 px-4 py-6">
        <div className="flex flex-col gap-6">
          {/* Add new tab */}
          <section>
            <h2 className="text-xl font-bold text-text mb-4">
              新しいカテゴリを追加（{customTabs.length}/5）
            </h2>
            <div className="flex gap-2">
              <Input
                value={newTabName}
                onChange={(e) => setNewTabName(e.target.value)}
                placeholder="カテゴリ名"
                className="flex-1"
                disabled={customTabs.length >= 5}
              />
              <Button
                variant="primary"
                onClick={handleAddTab}
                disabled={customTabs.length >= 5 || !newTabName.trim()}
              >
                追加
              </Button>
            </div>
          </section>

          {/* Custom tabs */}
          {customTabs.length > 0 && (
            <section>
              <h2 className="text-xl font-bold text-text mb-4">作成したカテゴリ</h2>
              <div className="flex flex-col gap-3">
                {customTabs.map((tab) => (
                  <Card key={tab.id}>
                    {editingTab?.id === tab.id ? (
                      <div className="flex gap-2">
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="flex-1"
                          autoFocus
                        />
                        <Button variant="primary" onClick={handleSaveEdit}>
                          保存
                        </Button>
                        <Button variant="secondary" onClick={() => setEditingTab(null)}>
                          取消
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-medium text-text">{tab.name}</span>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            onClick={() => handleStartEdit(tab)}
                            className="!p-2 !min-h-0"
                          >
                            ✏️ 編集
                          </Button>
                          <Button
                            variant="ghost"
                            onClick={() => setDeleteTabTarget(tab)}
                            className="!p-2 !min-h-0 !text-danger"
                          >
                            🗑️ 削除
                          </Button>
                        </div>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            </section>
          )}

          {/* Default tabs (read-only) */}
          <section>
            <h2 className="text-xl font-bold text-text mb-4">標準カテゴリ</h2>
            <p className="text-base text-text-secondary mb-4">
              これらのカテゴリは変更・削除できません
            </p>
            <div className="flex flex-col gap-3">
              {defaultTabs.map((tab) => (
                <Card key={tab.id}>
                  <span className="text-lg font-medium text-text-secondary">{tab.name}</span>
                </Card>
              ))}
            </div>
          </section>
        </div>
      </main>

      <ConfirmDialog
        isOpen={!!deleteTabTarget}
        title="カテゴリを削除"
        message={`「${deleteTabTarget?.name}」を削除します。このカテゴリに登録されていた場所は「よく行く」に移動します。`}
        confirmLabel="🗑️ 削除する"
        cancelLabel="やめる"
        variant="danger"
        onConfirm={handleDeleteTab}
        onCancel={() => setDeleteTabTarget(null)}
      />
    </div>
  );
}
