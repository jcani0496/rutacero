/**
 * Convert a base64 string to a Blob using the browser's native data-URL
 * fetch path. Off the main thread (the actual decode happens inside the
 * fetch implementation in C++/Rust), which matters for 5MB photos on
 * low-end Android devices where a synchronous `atob` + charCodeAt loop
 * stutters the UI.
 *
 * Works in:
 * - Chromium / WebKit / Firefox in any modern browser.
 * - Capacitor's WebView on Android and iOS.
 *
 * The returned Blob's `type` matches `contentType` because that's how the
 * data URL spec defines it.
 */
export async function base64ToBlob(b64: string, contentType: string): Promise<Blob> {
    const response = await fetch(`data:${contentType};base64,${b64}`);
    return response.blob();
}
