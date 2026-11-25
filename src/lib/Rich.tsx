import { Fragment } from 'react';

/** Renders a string with **bold** markup — the insight engine's only formatting. */
export function Rich({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith('**') && p.endsWith('**') ? <strong key={i}>{p.slice(2, -2)}</strong> : <Fragment key={i}>{p}</Fragment>,
      )}
    </>
  );
}
export const plain = (s: string) => s.replace(/\*\*/g, '');
