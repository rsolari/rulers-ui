'use client';

import { useEffect, useState, type ComponentType } from 'react';

export function DevTools() {
  const [Agentation, setAgentation] = useState<ComponentType | null>(null);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') {
      return;
    }

    const importer = new Function('specifier', 'return import(specifier);') as (
      specifier: string
    ) => Promise<{ PageFeedbackToolbarCSS?: ComponentType }>;

    importer('agentation')
      .then((module) => {
        setAgentation(() => module.PageFeedbackToolbarCSS ?? null);
      })
      .catch(() => {
        setAgentation(null);
      });
  }, []);

  if (process.env.NODE_ENV !== 'development' || !Agentation) {
    return null;
  }

  return <Agentation />;
}
