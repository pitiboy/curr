import { useEffect, useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';

const scrollRoots =
  '#main-content, .RaLayout-appFrame, .RaLayout-content, .RaLayout-contentWithSidebar';

function scrollPageToTop() {
  window.scrollTo(0, 0);
  const scrolling = document.scrollingElement;
  if (scrolling) scrolling.scrollTop = 0;
  document.querySelectorAll<HTMLElement>(scrollRoots).forEach((node) => {
    if (node.scrollTop !== 0) node.scrollTop = 0;
  });
}

/**
 * Hash routing keeps the previous window offset, so a list scrolled halfway
 * opens the next screen in the middle. Every new path starts at the top.
 */
export function useScrollToTopOnNavigate() {
  const { pathname } = useLocation();

  useEffect(() => {
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    return () => {
      window.history.scrollRestoration = previous;
    };
  }, []);

  useLayoutEffect(() => {
    scrollPageToTop();
  }, [pathname]);

  useEffect(() => {
    scrollPageToTop();
    const frame = requestAnimationFrame(scrollPageToTop);
    return () => cancelAnimationFrame(frame);
  }, [pathname]);
}
