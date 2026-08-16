import { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/**
 * Keep keyboard focus inside a dialog while it is open.
 *
 * Without this a modal is only visually modal: focus stays wherever it was, Tab
 * walks straight out into the page behind, and a screen reader user can miss
 * that the dialog opened at all.
 *
 * On open, focus moves to the first focusable element inside. On close, it goes
 * back to whatever was focused before — unless that element has since been
 * removed from the document, which happens when the dialog's own action
 * re-renders the thing that opened it.
 *
 * Returns a ref to attach to the dialog container.
 */
export function useFocusTrap<T extends HTMLElement>(active: boolean) {
  const containerRef = useRef<T>(null);

  useEffect(() => {
    if (!active) return;

    const container = containerRef.current;
    if (!container) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    const focusableItems = () =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
        // offsetParent is null for anything hidden, which should not take focus
        .filter(element => element.offsetParent !== null);

    (focusableItems()[0] ?? container).focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;

      const items = focusableItems();
      if (items.length === 0) {
        event.preventDefault();
        return;
      }

      const first = items[0];
      const last = items[items.length - 1];

      // Wrap around at both ends so Tab can never leave the dialog.
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      if (previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus();
      }
    };
  }, [active]);

  return containerRef;
}
