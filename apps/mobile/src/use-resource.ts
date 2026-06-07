// Tiny async-resource hook: load on mount + on key change, expose
// data/error/loading and a refresh() for pull-to-refresh. No external state
// library — V1 has two list screens and this is enough.

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "./api";

interface Resource<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  refreshing: boolean;
  refresh: () => void;
}

export function useResource<T>(loader: () => Promise<T>, key: string): Resource<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const run = useCallback(async (mode: "initial" | "refresh") => {
    if (mode === "refresh") setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const result = await loaderRef.current();
      setData(result);
    } catch (e) {
      // A 401 is handled by the api client's onUnauthorized (signs out); here
      // we just surface a readable message for everything else.
      setError(e instanceof ApiError ? e.message : "Couldn't load. Pull to retry.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void run("initial");
  }, [key, run]);

  const refresh = useCallback(() => {
    void run("refresh");
  }, [run]);

  return { data, error, loading, refreshing, refresh };
}
