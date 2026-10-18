// Small differences between the website and the installed desktop app.

/** True inside the Windows/Mac app built with Tauri, false on the website. */
export const IS_DESKTOP = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/** Open a web address in the user's normal browser (the desktop app has no tabs). */
export async function openExternal(url: string) {
  if (!IS_DESKTOP) {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }
  const { openUrl } = await import("@tauri-apps/plugin-opener");
  await openUrl(url);
}

/**
 * In the desktop app, send every link to another site (e.g. "Open in YouTube")
 * to the browser instead of trying to open it inside the app window.
 */
export function routeExternalLinksToBrowser() {
  if (!IS_DESKTOP) return;
  document.addEventListener("click", (event) => {
    if (event.defaultPrevented || event.button !== 0) return;
    const link = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
    if (!link) return;
    const url = new URL(link.href, window.location.href);
    if (!/^https?:$/.test(url.protocol) || url.origin === window.location.origin) return;
    event.preventDefault();
    openExternal(url.href).catch((err) => console.error("Couldn't open link", err));
  });
}
