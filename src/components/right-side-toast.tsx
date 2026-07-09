"use client";

import Image from "next/image";
import {useEffect, useState} from "react";

type RightSideToastProps = {
  iconAlt?: string;
  iconSrc?: string;
  message: string;
  tone?: "error" | "success";
};

export function RightSideToast({ iconAlt = "", iconSrc, message, tone = "success" }: RightSideToastProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setIsVisible(false), 3000);
    return () => window.clearTimeout(timeoutId);
  }, []);

  if (!isVisible) return null;

  return (
    <div className={`app-toast ${tone}`} role="status">
      {iconSrc ? <Image className="app-toast-icon" src={iconSrc} alt={iconAlt} width={44} height={44} /> : null}
      <span>{message}</span>
    </div>
  );
}
