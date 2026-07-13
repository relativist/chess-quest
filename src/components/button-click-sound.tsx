"use client";

import {useEffect, useRef} from "react";

type ButtonClickSoundProps = {
  soundSrc: string;
};

export function ButtonClickSound({ soundSrc }: ButtonClickSoundProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    function playButtonClickSound(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const button = target.closest("button");
      if (!button || button.disabled || button.getAttribute("aria-disabled") === "true") return;
      if (button.closest(".chess-board")) return;

      const audio = audioRef.current;
      if (!audio) return;

      audio.currentTime = 0;
      void audio.play().catch(() => undefined);
    }

    document.addEventListener("click", playButtonClickSound, true);
    return () => document.removeEventListener("click", playButtonClickSound, true);
  }, []);

  return <audio ref={audioRef} preload="auto" src={soundSrc} />;
}
