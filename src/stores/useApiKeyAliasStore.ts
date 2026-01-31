/**
 * API Key 别名管理
 * 存储到 LocalStorage，用于在 Monitor Center 显示 API Key 的别名
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const STORAGE_KEY = 'cpamc-api-key-aliases';

interface ApiKeyAliasState {
  /** API Key 别名映射，key 为完整的 API Key，value 为别名 */
  aliases: Record<string, string>;
  /** 设置别名 */
  setAlias: (apiKey: string, alias: string) => void;
  /** 删除别名 */
  removeAlias: (apiKey: string) => void;
  /** 获取别名 */
  getAlias: (apiKey: string) => string | undefined;
  /** 清空所有别名 */
  clearAll: () => void;
}

export const useApiKeyAliasStore = create<ApiKeyAliasState>()(
  persist(
    (set, get) => ({
      aliases: {},

      setAlias: (apiKey, alias) => {
        const trimmedAlias = alias.trim();
        set((state) => {
          if (!trimmedAlias) {
            // 如果别名为空，删除该条目
            const newAliases = { ...state.aliases };
            delete newAliases[apiKey];
            return { aliases: newAliases };
          }
          return {
            aliases: {
              ...state.aliases,
              [apiKey]: trimmedAlias
            }
          };
        });
      },

      removeAlias: (apiKey) => {
        set((state) => {
          const newAliases = { ...state.aliases };
          delete newAliases[apiKey];
          return { aliases: newAliases };
        });
      },

      getAlias: (apiKey) => {
        return get().aliases[apiKey];
      },

      clearAll: () => {
        set({ aliases: {} });
      }
    }),
    {
      name: STORAGE_KEY
    }
  )
);
