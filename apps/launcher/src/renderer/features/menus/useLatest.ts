import { useLayoutEffect, useRef } from 'react';

/** A ref that always holds the latest `value` (read it from events and timers, not render). */
export function useLatest<T>(value: T) {
  const ref = useRef(value);
  useLayoutEffect(() => {
    ref.current = value;
  });
  return ref;
}
