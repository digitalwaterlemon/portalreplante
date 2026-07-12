export function safeExternalUrl(value) {
    const text = String(value ?? "").trim();
    if (!text) return "";
    try {
        const parsed = new URL(text);
        if (parsed.protocol === "http:" || parsed.protocol === "https:") return parsed.href;
    } catch (_error) {
        return "";
    }
    return "";
}
