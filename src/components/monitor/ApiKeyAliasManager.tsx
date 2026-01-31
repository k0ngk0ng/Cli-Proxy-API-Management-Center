/**
 * API Key 别名管理组件
 * 用于设置和管理 API Key 的别名
 */

import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useApiKeyAliasStore } from '@/stores';
import { maskSecret } from '@/utils/monitor';
import styles from '@/pages/MonitorPage.module.scss';

interface ApiKeyAliasManagerProps {
  /** 当前可用的 API Key 列表 */
  apiKeys: string[];
}

export function ApiKeyAliasManager({ apiKeys }: ApiKeyAliasManagerProps) {
  const { t } = useTranslation();
  const aliases = useApiKeyAliasStore((state) => state.aliases);
  const setAlias = useApiKeyAliasStore((state) => state.setAlias);
  const removeAlias = useApiKeyAliasStore((state) => state.removeAlias);

  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  // 合并当前 API Keys 和已有别名的 Keys
  const allApiKeys = useMemo(() => {
    const keySet = new Set<string>(apiKeys);
    Object.keys(aliases).forEach((key) => keySet.add(key));
    return Array.from(keySet).sort();
  }, [apiKeys, aliases]);

  const handleEdit = (apiKey: string) => {
    setEditingKey(apiKey);
    setEditValue(aliases[apiKey] || '');
  };

  const handleSave = () => {
    if (editingKey) {
      setAlias(editingKey, editValue);
      setEditingKey(null);
      setEditValue('');
    }
  };

  const handleCancel = () => {
    setEditingKey(null);
    setEditValue('');
  };

  const handleDelete = (apiKey: string) => {
    removeAlias(apiKey);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  return (
    <Card
      title={t('monitor.alias.title')}
      subtitle={t('monitor.alias.subtitle')}
    >
      <div className={styles.aliasManager}>
        {allApiKeys.length === 0 ? (
          <div className={styles.emptyState}>{t('monitor.alias.empty')}</div>
        ) : (
          <div className={styles.aliasList}>
            {allApiKeys.map((apiKey) => {
              const alias = aliases[apiKey];
              const isEditing = editingKey === apiKey;

              return (
                <div key={apiKey} className={styles.aliasItem}>
                  <div className={styles.aliasKeyInfo}>
                    <span className={styles.aliasKey} title={apiKey}>
                      {maskSecret(apiKey)}
                    </span>
                    {alias && !isEditing && (
                      <span className={styles.aliasValue}>→ {alias}</span>
                    )}
                  </div>
                  <div className={styles.aliasActions}>
                    {isEditing ? (
                      <>
                        <input
                          type="text"
                          className={styles.aliasInput}
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={handleKeyDown}
                          placeholder={t('monitor.alias.placeholder')}
                          autoFocus
                        />
                        <Button size="sm" onClick={handleSave}>
                          {t('common.save')}
                        </Button>
                        <Button size="sm" variant="secondary" onClick={handleCancel}>
                          {t('common.cancel')}
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button size="sm" variant="secondary" onClick={() => handleEdit(apiKey)}>
                          {alias ? t('common.edit') : t('monitor.alias.set')}
                        </Button>
                        {alias && (
                          <Button size="sm" variant="danger" onClick={() => handleDelete(apiKey)}>
                            {t('common.delete')}
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
}
