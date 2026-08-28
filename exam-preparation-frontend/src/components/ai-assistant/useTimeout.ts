import { useRef, useEffect } from "react";

export function useTimeout(callback: () => void, delay: number | null) {
  const savedCallback = useRef(callback);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (typeof delay === "number") {
      timerRef.current = setTimeout(() => savedCallback.current(), delay);
      return () => {
        if (timerRef.current) clearTimeout(timerRef.current);
      };
    }
    return undefined;
  }, [delay]);

  return timerRef;
}
