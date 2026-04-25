import { useEffect, useState } from "react";

export const useServerTimer = (startedAt: number | null) => {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!startedAt) return;

    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [startedAt]);

  if (!startedAt) return "00:00";

  const elapsed = Math.max(0, Math.floor((now - startedAt) / 1000));
  const minutes = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const seconds = String(elapsed % 60).padStart(2, "0");

  return `${minutes}:${seconds}`;
};
