export function normalizedPath(pathValue) {
  try {
    const url = new URL(pathValue, "http://127.0.0.1");
    const names = [...new Set([...url.searchParams.keys()])].sort();
    return `${url.pathname || "/"}${names.length ? `?${names.map((name) => `${encodeURIComponent(name)}=*`).join("&")}` : ""}`;
  } catch { return null; }
}
