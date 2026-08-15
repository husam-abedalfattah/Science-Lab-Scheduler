import { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(',');

/**
 * Open modals, outermost first. Every modal listens on `document` in the
 * capture phase, and those listeners fire in registration order -- so without
 * this the outer modal handles Escape before the confirmation stacked on top
 * of it. `stopPropagation` cannot help either: it does not stop other
 * listeners bound to the same node. Gating on "am I the top of the stack?"
 * makes Escape and the Tab trap apply to the frontmost modal only.
 */
const modalStack: symbol[] = [];

/**
 * The page's own overflow, captured when the first modal opens and restored
 * when the last one closes. Held here rather than per-modal so the restore
 * does not depend on modals unmounting in the order they opened -- an outer
 * panel closing first would otherwise hand back "hidden" and leave the page
 * permanently unscrollable.
 */
let savedBodyOverflow: string | null = null;

/**
 * Gives a modal the behaviour keyboard and screen-reader users expect:
 * Escape closes it, Tab is trapped inside it, the page behind it stops
 * scrolling, focus moves in on open and returns to the trigger on close.
 *
 * Attach the returned ref to the modal's panel element.
 */
export function useModalA11y(isOpen: boolean, onClose: () => void) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Held in a ref so a new inline onClose on every render does not tear down
  // and rebuild the listeners.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;

    const token = Symbol('modal');
    modalStack.push(token);
    const isTopmost = () => modalStack[modalStack.length - 1] === token;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    if (modalStack.length === 1) savedBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusables = () =>
      Array.from(
        containerRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) || []
      ).filter(el => el.offsetParent !== null || el === document.activeElement);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isTopmost()) return;

      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;

      const items = focusables();
      if (items.length === 0) return;

      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;

      if (e.shiftKey && (active === first || !containerRef.current?.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);

    const focusTimer = window.setTimeout(() => {
      const items = focusables();
      (items[0] || containerRef.current)?.focus();
    }, 0);

    return () => {
      const index = modalStack.indexOf(token);
      if (index !== -1) modalStack.splice(index, 1);

      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown, true);
      // Only the last modal on screen restores scrolling; an inner dialog
      // closing must not unlock the page behind the modal still open.
      if (modalStack.length === 0) {
        document.body.style.overflow = savedBodyOverflow ?? '';
        savedBodyOverflow = null;
      }
      previouslyFocused?.focus?.();
    };
  }, [isOpen]);

  return containerRef;
}
