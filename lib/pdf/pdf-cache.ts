/**
 * PDF Document Cache using IndexedDB
 *
 * Provides client-side caching for PDF documents to improve
 * editor load times and reduce network requests.
 *
 * Features:
 * - Stores PDF ArrayBuffers in IndexedDB
 * - Automatic expiration (24 hours default)
 * - LRU eviction when cache exceeds size limit
 * - Graceful fallback if IndexedDB unavailable
 *
 * PERFORMANCE:
 * - First load: Network fetch + cache write (~500-2000ms)
 * - Subsequent loads: Cache read (~5-50ms)
 */

const DB_NAME = 'certificator-pdf-cache';
const DB_VERSION = 1;
const STORE_NAME = 'pdfs';

/** Default cache expiration time (24 hours in milliseconds) */
const DEFAULT_EXPIRATION_MS = 24 * 60 * 60 * 1000;

/** Maximum number of PDFs to cache */
const MAX_CACHE_SIZE = 20;

// ============================================================================
// TYPES
// ============================================================================

interface CachedPDF {
    /** URL or unique identifier for the PDF */
    key: string;
    /** PDF binary data */
    data: ArrayBuffer;
    /** Cache timestamp for expiration check */
    cachedAt: number;
    /** Last access time for LRU eviction */
    lastAccessed: number;
}

// ============================================================================
// DATABASE INITIALIZATION
// ============================================================================

let dbPromise: Promise<IDBDatabase | null> | null = null;

/**
 * Get or create the IndexedDB database connection.
 * Returns null if IndexedDB is not available.
 */
function getDB(): Promise<IDBDatabase | null> {
    if (typeof indexedDB === 'undefined') {
        return Promise.resolve(null);
    }

    if (dbPromise) {
        return dbPromise;
    }

    dbPromise = new Promise((resolve) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
            console.warn('[PDFCache] Failed to open IndexedDB:', request.error);
            resolve(null);
        };

        request.onsuccess = () => {
            resolve(request.result);
        };

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;

            // Create object store if it doesn't exist
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' });
                store.createIndex('cachedAt', 'cachedAt', { unique: false });
                store.createIndex('lastAccessed', 'lastAccessed', { unique: false });
            }
        };
    });

    return dbPromise;
}

// ============================================================================
// CACHE OPERATIONS
// ============================================================================

/**
 * Get a cached PDF by URL/key.
 *
 * @param key - URL or unique identifier for the PDF
 * @param maxAge - Maximum age in milliseconds (default: 24 hours)
 * @returns Cached PDF ArrayBuffer or null if not found/expired
 */
export async function getCachedPDF(
    key: string,
    maxAge: number = DEFAULT_EXPIRATION_MS
): Promise<ArrayBuffer | null> {
    try {
        const db = await getDB();
        if (!db) return null;

        return new Promise((resolve) => {
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(key);

            request.onerror = () => {
                resolve(null);
            };

            request.onsuccess = () => {
                const result = request.result as CachedPDF | undefined;

                if (!result) {
                    resolve(null);
                    return;
                }

                // Check expiration
                const age = Date.now() - result.cachedAt;
                if (age > maxAge) {
                    // Remove expired entry
                    store.delete(key);
                    resolve(null);
                    return;
                }

                // Update last accessed time for LRU
                result.lastAccessed = Date.now();
                store.put(result);

                resolve(result.data);
            };
        });
    } catch {
        return null;
    }
}

/**
 * Store a PDF in the cache.
 *
 * @param key - URL or unique identifier for the PDF
 * @param data - PDF binary data
 */
export async function setCachedPDF(key: string, data: ArrayBuffer): Promise<void> {
    try {
        const db = await getDB();
        if (!db) return;

        // First, ensure we don't exceed cache size
        await evictIfNecessary(db);

        const now = Date.now();
        const entry: CachedPDF = {
            key,
            data,
            cachedAt: now,
            lastAccessed: now,
        };

        return new Promise((resolve) => {
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.put(entry);

            request.onerror = () => {
                console.warn('[PDFCache] Failed to cache PDF:', request.error);
                resolve();
            };

            request.onsuccess = () => {
                resolve();
            };
        });
    } catch {
        // Silently fail - caching is optional
    }
}

/**
 * Remove a specific PDF from the cache.
 *
 * @param key - URL or unique identifier for the PDF
 */
export async function removeCachedPDF(key: string): Promise<void> {
    try {
        const db = await getDB();
        if (!db) return;

        return new Promise((resolve) => {
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            store.delete(key);
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => resolve();
        });
    } catch {
        // Silently fail
    }
}

/**
 * Clear all cached PDFs.
 */
export async function clearPDFCache(): Promise<void> {
    try {
        const db = await getDB();
        if (!db) return;

        return new Promise((resolve) => {
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            store.clear();
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => resolve();
        });
    } catch {
        // Silently fail
    }
}

/**
 * Get cache statistics for debugging.
 */
export async function getCacheStats(): Promise<{
    count: number;
    totalSize: number;
} | null> {
    try {
        const db = await getDB();
        if (!db) return null;

        return new Promise((resolve) => {
            const transaction = db.transaction(STORE_NAME, 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const countRequest = store.count();
            let totalSize = 0;
            let count = 0;

            countRequest.onsuccess = () => {
                count = countRequest.result;
            };

            const cursorRequest = store.openCursor();
            cursorRequest.onsuccess = () => {
                const cursor = cursorRequest.result;
                if (cursor) {
                    const entry = cursor.value as CachedPDF;
                    totalSize += entry.data.byteLength;
                    cursor.continue();
                }
            };

            transaction.oncomplete = () => {
                resolve({ count, totalSize });
            };

            transaction.onerror = () => {
                resolve(null);
            };
        });
    } catch {
        return null;
    }
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

/**
 * Evict least recently used entries if cache exceeds size limit.
 */
async function evictIfNecessary(db: IDBDatabase): Promise<void> {
    return new Promise((resolve) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const countRequest = store.count();

        countRequest.onsuccess = () => {
            const count = countRequest.result;

            if (count < MAX_CACHE_SIZE) {
                resolve();
                return;
            }

            // Get entries sorted by lastAccessed (oldest first)
            const index = store.index('lastAccessed');
            const keysToDelete: string[] = [];
            const entriesToDelete = count - MAX_CACHE_SIZE + 1; // +1 to make room for new entry

            const cursorRequest = index.openCursor();
            cursorRequest.onsuccess = () => {
                const cursor = cursorRequest.result;
                if (cursor && keysToDelete.length < entriesToDelete) {
                    keysToDelete.push(cursor.value.key);
                    cursor.continue();
                } else {
                    // Delete old entries
                    for (const key of keysToDelete) {
                        store.delete(key);
                    }
                }
            };
        };

        transaction.oncomplete = () => resolve();
        transaction.onerror = () => resolve();
    });
}

// ============================================================================
// CONVENIENCE METHODS
// ============================================================================

/**
 * Fetch a PDF with caching.
 * First checks cache, then fetches from network if not cached.
 *
 * @param url - URL to fetch PDF from
 * @param options - Fetch options (for network request)
 * @returns PDF ArrayBuffer
 */
export async function fetchPDFWithCache(
    url: string,
    options?: RequestInit
): Promise<ArrayBuffer> {
    // Try cache first
    const cached = await getCachedPDF(url);
    if (cached) {
        return cached;
    }

    // Fetch from network
    const response = await fetch(url, options);
    if (!response.ok) {
        throw new Error(`Failed to fetch PDF: ${response.status}`);
    }

    const data = await response.arrayBuffer();

    // Cache for next time (don't await - fire and forget)
    setCachedPDF(url, data).catch(() => { });

    return data;
}
