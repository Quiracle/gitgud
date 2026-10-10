import { Fragment, type ComponentType, type ReactNode } from "react";

type TagComponents = Record<string, ComponentType<{ children: ReactNode }>>;

/**
 * Renders a translated string whose emphasis is marked with simple tags, such as
 * "Each card is a <em>commit</em>". Only the tags passed in `tags` become components;
 * everything else stays plain text, so translations can never inject markup.
 */
export function Rich({ text, tags }: { text: string; tags: TagComponents }) {
  const parts: ReactNode[] = [];
  const pattern = /<(\w+)>(.*?)<\/\1>/g;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const [whole, tag, content] = match;
    const index = match.index ?? 0;
    if (index > last) parts.push(text.slice(last, index));
    const Tag = tags[tag];
    parts.push(Tag ? <Tag key={index}>{content}</Tag> : whole);
    last = index + whole.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts.map((part, index) => <Fragment key={index}>{part}</Fragment>)}</>;
}
