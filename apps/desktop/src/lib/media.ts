const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api/v1";

function storefrontOrigin() {
  const configured = import.meta.env.VITE_STOREFRONT_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  if (typeof window === "undefined") return "";
  const api = new URL(apiUrl, window.location.origin);
  if (["localhost", "127.0.0.1"].includes(api.hostname)) {
    return `${api.protocol}//${api.hostname}:3000`;
  }
  return window.location.origin;
}

export function resolveMediaUrl(url?: string | null) {
  const value = url?.trim() ?? "";
  if (!value || /^(?:data|blob):/i.test(value)) return value;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("/products/")) return `${storefrontOrigin()}${value}`;
  if (value.startsWith("/")) {
    if (typeof window === "undefined") return value;
    return new URL(value, window.location.origin).toString();
  }
  return value;
}
