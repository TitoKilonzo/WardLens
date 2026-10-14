import { useEffect, useState } from 'react';
import { api } from '../utils/api';
export function useFetch<T>(path: string, dependencies: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = () => setRefreshKey((n) => n + 1);
  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    api<T>(path).then((result) => { if (active) setData(result); }).catch((e: unknown) => { if (active) setError(e instanceof Error ? e.message : 'Unable to load data.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, refreshKey, ...dependencies]);
  return { data, loading, error, refresh };
}
