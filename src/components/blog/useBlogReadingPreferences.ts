import { useEffect, useState } from "react";

type ReadingPreferences = { largeText: boolean; serifText: boolean };

/** The head initializer applies the font before paint; React owns the controls. */
export function useBlogReadingPreferences() {
  const [preferences, setPreferences] = useState<ReadingPreferences>({ largeText: false, serifText: false });

  useEffect(() => {
    const root = document.documentElement;
    setPreferences({ largeText: root.dataset.blogTextSize === "larger", serifText: root.dataset.blogTextFont === "serif" });
  }, []);

  function updatePreferences(change: Partial<ReadingPreferences>) {
    const next = { ...preferences, ...change };
    const root = document.documentElement;
    root.dataset.blogTextSize = next.largeText ? "larger" : "standard";
    root.dataset.blogTextFont = next.serifText ? "serif" : "sans";
    setPreferences(next);
    try {
      localStorage.setItem("mahad-blog-reading", JSON.stringify(next));
    } catch {
      // Keep the choice for this page even if the browser cannot remember it.
    }
  }

  return { ...preferences, updatePreferences };
}
