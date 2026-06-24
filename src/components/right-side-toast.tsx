"use client";

import { useEffect, useState } from "react";

type RightSideToastProps = {
  message: string;
  tone?: "error" | "success";
};

export function RightSideToast({ message, tone = "success" }: RightSideToastProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setIsVisible(false), 3000);
    return () => window.clearTimeout(timeoutId);
  }, []);

  if (!isVisible) return null;

  return <div className={`app-toast ${tone}`} role="status">{message}</div>;
}
