export type ReferenceContextItem = {
  id: string;
  name: string;
  type: string;
  size: number;
  summary: string;
};

const maxTextChars = 1800;

export async function buildReferenceContextItem(file: File): Promise<ReferenceContextItem> {
  const base = {
    id: `${file.name}-${file.size}-${file.lastModified}`,
    name: file.name,
    type: file.type || "application/octet-stream",
    size: file.size,
  };

  if (file.type.startsWith("image/")) {
    return {
      ...base,
      summary: `Image reference: ${file.name}; type=${file.type}; size=${file.size} bytes.`,
    };
  }

  if (isReadableText(file)) {
    const text = await file.text();
    return {
      ...base,
      summary: normalizeText(text).slice(0, maxTextChars),
    };
  }

  return {
    ...base,
    summary: `File reference: ${file.name}; type=${base.type}; size=${file.size} bytes.`,
  };
}

export function buildReferenceContextBlock(items: ReferenceContextItem[]): string {
  if (items.length === 0) return "";
  const sections = items.map(
    (item, index) =>
      `Reference ${index + 1}: ${item.name}\nType: ${item.type}\nSummary:\n${item.summary}`,
  );
  return `\n\nReference Context\n${sections.join("\n\n")}`;
}

function isReadableText(file: File) {
  const name = file.name.toLowerCase();
  return (
    file.type.startsWith("text/") ||
    name.endsWith(".html") ||
    name.endsWith(".htm") ||
    name.endsWith(".md") ||
    name.endsWith(".txt") ||
    name.endsWith(".json") ||
    name.endsWith(".csv")
  );
}

function normalizeText(text: string) {
  return text
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
