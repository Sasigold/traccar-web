import { useRef, useEffect, useCallback, useState } from 'react';
import { useDispatch } from 'react-redux';
import { messagesActions } from './store';

export const pageSize = 50;

export const usePrevious = (value) => {
  const ref = useRef();
  useEffect(() => {
    ref.current = value;
  });
  return ref.current;
};

export const useAsyncTask = (effect, deps) => {
  const dispatch = useDispatch();
  useEffect(() => {
    const controller = new AbortController();
    let cleanup;
    effect({ signal: controller.signal })
      .then((result) => {
        cleanup = result;
      })
      .catch((error) => {
        if (error.name !== 'AbortError') {
          dispatch(messagesActions.push(error.message));
        }
      });
    return () => {
      controller.abort();
      cleanup?.();
    };
    // eslint-disable-next-line @eslint-react/exhaustive-deps
  }, [...deps, dispatch]);
};

// A cancelled request (the page was left, or a newer run replaced it) is not an error to show.
const isAbort = (error) => error?.name === 'AbortError';

export const useCatch = (method) => {
  const dispatch = useDispatch();
  return (...parameters) => {
    method(...parameters).catch(
      (error) => isAbort(error) || dispatch(messagesActions.push(error.message)),
    );
  };
};

// PRF-05: a report run. `method` gets the parameters plus a `signal`; a new run cancels the one
// before it, and leaving the page cancels the last one.
export const useRunCallback = (method, deps) => {
  const dispatch = useDispatch();
  const controllerRef = useRef(null);
  useEffect(() => () => controllerRef.current?.abort(), []);
  return useCallback(
    (parameters) => {
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      return method({ ...parameters, signal: controller.signal }).catch(
        (error) => isAbort(error) || dispatch(messagesActions.push(error.message)),
      );
    },
    // eslint-disable-next-line @eslint-react/exhaustive-deps
    deps,
  );
};

export const useCatchCallback = (method, deps) => {
  const dispatch = useDispatch();
  return useCallback(
    (...parameters) => {
      method(...parameters).catch(
        (error) => isAbort(error) || dispatch(messagesActions.push(error.message)),
      );
    },
    // eslint-disable-next-line @eslint-react/exhaustive-deps
    deps,
  );
};

export const useScrollToLoad = (loadMore) => {
  const [sentinel, setSentinel] = useState(null);
  const loadingRef = useRef(false);
  const loadMoreRef = useRef(loadMore);
  loadMoreRef.current = loadMore;

  useEffect(() => {
    if (!sentinel) return undefined;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !loadingRef.current) {
        loadingRef.current = true;
        Promise.resolve(loadMoreRef.current?.()).finally(() => {
          loadingRef.current = false;
        });
      }
    });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [sentinel]);

  return setSentinel;
};
