import { useEffect, useState } from 'react';

/** Text inside react-admin's `#react-admin-title` portal (current screen title). */
export function useRaPageTitle(): string {
  const [title, setTitle] = useState('');

  useEffect(() => {
    const node = document.getElementById('react-admin-title');
    if (!node) {
      return;
    }

    const sync = () => {
      setTitle(node.textContent?.trim() ?? '');
    };

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(node, {
      characterData: true,
      childList: true,
      subtree: true,
    });
    return () => observer.disconnect();
  }, []);

  return title;
}
