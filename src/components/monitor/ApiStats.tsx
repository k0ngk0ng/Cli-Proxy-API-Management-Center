import { useMemo, useState, useCallback, Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { TimeRangeSelector, formatTimeRangeCaption, type TimeRange } from './TimeRangeSelector';
import {
  formatTimestamp,
  getRateClassName,
  filterDataByTimeRange,
  maskSecret,
  type DateRange,
} from '@/utils/monitor';
import type { UsageData } from '@/pages/MonitorPage';
import styles from '@/pages/MonitorPage.module.scss';

interface ApiStatsProps {
  data: UsageData | null;
  loading: boolean;
}

interface ModelStat {
  requests: number;
  success: number;
  failed: number;
  successRate: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  recentRequests: { failed: boolean; timestamp: number }[];
  lastTimestamp: number;
}

interface ApiStat {
  apiKey: string;
  maskedKey: string;
  totalRequests: number;
  successRequests: number;
  failedRequests: number;
  successRate: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  lastRequestTime: number;
  recentRequests: { failed: boolean; timestamp: number }[];
  models: Record<string, ModelStat>;
}

export function ApiStats({ data, loading }: ApiStatsProps) {
  const { t } = useTranslation();
  const [expandedApi, setExpandedApi] = useState<string | null>(null);
  const [filterApi, setFilterApi] = useState('');
  const [filterModel, setFilterModel] = useState('');
  const [filterStatus, setFilterStatus] = useState<'' | 'success' | 'failed'>('');

  // 时间范围状态
  const [timeRange, setTimeRange] = useState<TimeRange>(7);
  const [customRange, setCustomRange] = useState<DateRange | undefined>();

  // 处理时间范围变化
  const handleTimeRangeChange = useCallback((range: TimeRange, custom?: DateRange) => {
    setTimeRange(range);
    if (custom) {
      setCustomRange(custom);
    }
  }, []);

  // 根据时间范围过滤数据
  const timeFilteredData = useMemo(() => {
    return filterDataByTimeRange(data, timeRange, customRange);
  }, [data, timeRange, customRange]);

  // 计算 API 统计数据
  const apiStats = useMemo(() => {
    if (!timeFilteredData?.apis) return [];

    const stats: Record<string, ApiStat> = {};

    Object.entries(timeFilteredData.apis).forEach(([apiKey, apiData]) => {
      if (!apiData?.models) return;

      const masked = maskSecret(apiKey);

      if (!stats[apiKey]) {
        stats[apiKey] = {
          apiKey,
          maskedKey: masked,
          totalRequests: 0,
          successRequests: 0,
          failedRequests: 0,
          successRate: 0,
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          lastRequestTime: 0,
          recentRequests: [],
          models: {},
        };
      }

      Object.entries(apiData.models).forEach(([modelName, modelData]) => {
        if (!modelData?.details) return;

        modelData.details.forEach((detail) => {
          const timestamp = detail.timestamp ? new Date(detail.timestamp).getTime() : 0;

          stats[apiKey].totalRequests++;
          if (detail.failed) {
            stats[apiKey].failedRequests++;
          } else {
            stats[apiKey].successRequests++;
          }

          // Token 统计
          const tokens = detail.tokens || {};
          stats[apiKey].inputTokens += tokens.input_tokens || 0;
          stats[apiKey].outputTokens += tokens.output_tokens || 0;
          stats[apiKey].totalTokens += tokens.total_tokens || 0;

          // 更新最近请求时间
          if (timestamp > stats[apiKey].lastRequestTime) {
            stats[apiKey].lastRequestTime = timestamp;
          }

          // 收集请求状态
          stats[apiKey].recentRequests.push({ failed: detail.failed, timestamp });

          // 模型统计
          if (!stats[apiKey].models[modelName]) {
            stats[apiKey].models[modelName] = {
              requests: 0,
              success: 0,
              failed: 0,
              successRate: 0,
              inputTokens: 0,
              outputTokens: 0,
              totalTokens: 0,
              recentRequests: [],
              lastTimestamp: 0,
            };
          }
          stats[apiKey].models[modelName].requests++;
          if (detail.failed) {
            stats[apiKey].models[modelName].failed++;
          } else {
            stats[apiKey].models[modelName].success++;
          }
          stats[apiKey].models[modelName].inputTokens += tokens.input_tokens || 0;
          stats[apiKey].models[modelName].outputTokens += tokens.output_tokens || 0;
          stats[apiKey].models[modelName].totalTokens += tokens.total_tokens || 0;
          stats[apiKey].models[modelName].recentRequests.push({ failed: detail.failed, timestamp });
          if (timestamp > stats[apiKey].models[modelName].lastTimestamp) {
            stats[apiKey].models[modelName].lastTimestamp = timestamp;
          }
        });
      });
    });

    // 计算成功率并排序请求
    Object.values(stats).forEach((stat) => {
      stat.successRate = stat.totalRequests > 0
        ? (stat.successRequests / stat.totalRequests) * 100
        : 0;
      // 按时间排序，取最近12个
      stat.recentRequests.sort((a, b) => a.timestamp - b.timestamp);
      stat.recentRequests = stat.recentRequests.slice(-12);

      Object.values(stat.models).forEach((model) => {
        model.successRate = model.requests > 0
          ? (model.success / model.requests) * 100
          : 0;
        model.recentRequests.sort((a, b) => a.timestamp - b.timestamp);
        model.recentRequests = model.recentRequests.slice(-12);
      });
    });

    return Object.values(stats)
      .filter((stat) => stat.totalRequests > 0)
      .sort((a, b) => b.totalRequests - a.totalRequests)
      .slice(0, 10);
  }, [timeFilteredData]);

  // 获取所有 API 和模型列表
  const { apis, models } = useMemo(() => {
    const apiSet = new Set<string>();
    const modelSet = new Set<string>();

    apiStats.forEach((stat) => {
      apiSet.add(stat.maskedKey);
      Object.keys(stat.models).forEach((model) => modelSet.add(model));
    });

    return {
      apis: Array.from(apiSet).sort(),
      models: Array.from(modelSet).sort(),
    };
  }, [apiStats]);

  // 过滤后的数据
  const filteredStats = useMemo(() => {
    return apiStats.filter((stat) => {
      if (filterApi && stat.maskedKey !== filterApi) return false;
      if (filterModel && !stat.models[filterModel]) return false;
      if (filterStatus === 'success' && stat.failedRequests > 0) return false;
      if (filterStatus === 'failed' && stat.failedRequests === 0) return false;
      return true;
    });
  }, [apiStats, filterApi, filterModel, filterStatus]);

  // 切换展开状态
  const toggleExpand = (apiKey: string) => {
    setExpandedApi(expandedApi === apiKey ? null : apiKey);
  };

  // 格式化数字
  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toLocaleString();
  };

  return (
    <Card
      title={t('monitor.api.title')}
      subtitle={
        <span>
          {formatTimeRangeCaption(timeRange, customRange, t)} · {t('monitor.api.subtitle')}
          <span style={{ color: 'var(--text-tertiary)' }}> · {t('monitor.api.click_hint')}</span>
        </span>
      }
      extra={
        <TimeRangeSelector
          value={timeRange}
          onChange={handleTimeRangeChange}
          customRange={customRange}
        />
      }
    >
      {/* 筛选器 */}
      <div className={styles.logFilters}>
        <select
          className={styles.logSelect}
          value={filterApi}
          onChange={(e) => setFilterApi(e.target.value)}
        >
          <option value="">{t('monitor.api.all_apis')}</option>
          {apis.map((api) => (
            <option key={api} value={api}>{api}</option>
          ))}
        </select>
        <select
          className={styles.logSelect}
          value={filterModel}
          onChange={(e) => setFilterModel(e.target.value)}
        >
          <option value="">{t('monitor.api.all_models')}</option>
          {models.map((model) => (
            <option key={model} value={model}>{model}</option>
          ))}
        </select>
        <select
          className={styles.logSelect}
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as '' | 'success' | 'failed')}
        >
          <option value="">{t('monitor.api.all_status')}</option>
          <option value="success">{t('monitor.api.only_success')}</option>
          <option value="failed">{t('monitor.api.only_failed')}</option>
        </select>
      </div>

      {/* 表格 */}
      <div className={styles.tableWrapper}>
        {loading ? (
          <div className={styles.emptyState}>{t('common.loading')}</div>
        ) : filteredStats.length === 0 ? (
          <div className={styles.emptyState}>{t('monitor.no_data')}</div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t('monitor.api.header_key')}</th>
                <th>{t('monitor.api.header_count')}</th>
                <th>{t('monitor.api.header_rate')}</th>
                <th>{t('monitor.api.header_tokens')}</th>
                <th>{t('monitor.api.header_recent')}</th>
                <th>{t('monitor.api.header_time')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredStats.map((stat) => (
                <Fragment key={stat.apiKey}>
                  <tr
                    className={styles.expandable}
                    onClick={() => toggleExpand(stat.apiKey)}
                  >
                    <td>
                      <span className={styles.channelSecret}>{stat.maskedKey}</span>
                    </td>
                    <td>{stat.totalRequests.toLocaleString()}</td>
                    <td className={getRateClassName(stat.successRate, styles)}>
                      {stat.successRate.toFixed(1)}%
                    </td>
                    <td title={`Input: ${stat.inputTokens.toLocaleString()} / Output: ${stat.outputTokens.toLocaleString()}`}>
                      {formatNumber(stat.totalTokens)}
                    </td>
                    <td>
                      <div className={styles.statusBars}>
                        {stat.recentRequests.map((req, i) => (
                          <div
                            key={i}
                            className={`${styles.statusBar} ${req.failed ? styles.failure : styles.success}`}
                          />
                        ))}
                      </div>
                    </td>
                    <td>{formatTimestamp(stat.lastRequestTime)}</td>
                  </tr>
                  {expandedApi === stat.apiKey && (
                    <tr key={`${stat.apiKey}-detail`}>
                      <td colSpan={6} className={styles.expandDetail}>
                        <div className={styles.expandTableWrapper}>
                        <table className={styles.table}>
                          <thead>
                            <tr>
                              <th>{t('monitor.api.model')}</th>
                              <th>{t('monitor.api.header_count')}</th>
                              <th>{t('monitor.api.header_rate')}</th>
                              <th>{t('monitor.api.success')}/{t('monitor.api.failed')}</th>
                              <th>{t('monitor.api.header_tokens')}</th>
                              <th>{t('monitor.api.header_recent')}</th>
                              <th>{t('monitor.api.header_time')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Object.entries(stat.models)
                              .sort((a, b) => b[1].requests - a[1].requests)
                              .map(([modelName, modelStat]) => (
                                <tr key={modelName}>
                                  <td>{modelName}</td>
                                  <td>{modelStat.requests.toLocaleString()}</td>
                                  <td className={getRateClassName(modelStat.successRate, styles)}>
                                    {modelStat.successRate.toFixed(1)}%
                                  </td>
                                  <td>
                                    <span className={styles.kpiSuccess}>{modelStat.success}</span>
                                    {' / '}
                                    <span className={styles.kpiFailure}>{modelStat.failed}</span>
                                  </td>
                                  <td title={`Input: ${modelStat.inputTokens.toLocaleString()} / Output: ${modelStat.outputTokens.toLocaleString()}`}>
                                    {formatNumber(modelStat.totalTokens)}
                                  </td>
                                  <td>
                                    <div className={styles.statusBars}>
                                      {modelStat.recentRequests.map((req, i) => (
                                        <div
                                          key={i}
                                          className={`${styles.statusBar} ${req.failed ? styles.failure : styles.success}`}
                                        />
                                      ))}
                                    </div>
                                  </td>
                                  <td>{formatTimestamp(modelStat.lastTimestamp)}</td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Card>
  );
}
