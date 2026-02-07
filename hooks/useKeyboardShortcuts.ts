/**
 * useKeyboardShortcuts Hook
 * 
 * A hook for registering keyboard shortcuts with modifier key support.
 * Automatically cleans up event listeners on unmount.
 * 
 * @example
 * ```tsx
 * useKeyboardShortcuts({
 *   'ctrl+s': (e) => { e.preventDefault(); handleSave(); },
 *   'ctrl+z': handleUndo,
 *   'escape': handleClose,
 * });
 * ```
 */

'use client';

import { useEffect, useCallback, useRef } from 'react';

/** A keyboard shortcut handler function */
type ShortcutHandler = (event: KeyboardEvent) => void;

/** Map of shortcut keys to their handlers */
type ShortcutMap = Record<string, ShortcutHandler>;

/**
 * Parse a shortcut string like "ctrl+shift+s" into components
 */
function parseShortcut(shortcut: string): {
    key: string;
    ctrl: boolean;
    shift: boolean;
    alt: boolean;
    meta: boolean;
} {
    const parts = shortcut.toLowerCase().split('+');
    const key = parts.pop() || '';

    return {
        key,
        ctrl: parts.includes('ctrl'),
        shift: parts.includes('shift'),
        alt: parts.includes('alt'),
        meta: parts.includes('meta') || parts.includes('cmd'),
    };
}

/**
 * Check if a keyboard event matches a shortcut definition
 */
function matchesShortcut(
    event: KeyboardEvent,
    shortcut: ReturnType<typeof parseShortcut>
): boolean {
    const eventKey = event.key.toLowerCase();

    // Handle special keys
    const keyMatches =
        eventKey === shortcut.key ||
        event.code.toLowerCase() === shortcut.key ||
        event.code.toLowerCase() === `key${shortcut.key}`;

    return (
        keyMatches &&
        event.ctrlKey === shortcut.ctrl &&
        event.shiftKey === shortcut.shift &&
        event.altKey === shortcut.alt &&
        event.metaKey === shortcut.meta
    );
}

/**
 * Hook for registering keyboard shortcuts
 * 
 * @param shortcuts - Map of shortcut strings to handler functions
 * @param enabled - Whether shortcuts are currently enabled (default: true)
 */
export function useKeyboardShortcuts(
    shortcuts: ShortcutMap,
    enabled: boolean = true
): void {
    // Use ref to avoid re-registering listeners when shortcuts object changes
    const shortcutsRef = useRef(shortcuts);
    shortcutsRef.current = shortcuts;

    const handleKeyDown = useCallback((event: KeyboardEvent) => {
        // Ignore events from input elements unless explicitly handled
        const target = event.target as HTMLElement;
        const isInputElement =
            target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.isContentEditable;

        for (const [shortcutStr, handler] of Object.entries(shortcutsRef.current)) {
            const shortcut = parseShortcut(shortcutStr);

            // Skip non-modifier shortcuts when in input elements
            if (isInputElement && !shortcut.ctrl && !shortcut.alt && !shortcut.meta) {
                continue;
            }

            if (matchesShortcut(event, shortcut)) {
                handler(event);
                return;
            }
        }
    }, []);

    useEffect(() => {
        if (!enabled) return;

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [enabled, handleKeyDown]);
}

/**
 * Common keyboard shortcut presets
 */
export const SHORTCUT_KEYS = {
    SAVE: 'ctrl+s',
    UNDO: 'ctrl+z',
    REDO: 'ctrl+shift+z',
    ESCAPE: 'escape',
    DELETE: 'delete',
    BACKSPACE: 'backspace',
    COPY: 'ctrl+c',
    PASTE: 'ctrl+v',
    CUT: 'ctrl+x',
    SELECT_ALL: 'ctrl+a',
} as const;
