export interface GuideSnippet { language: string; code: string; line: number }
export function guideSnippets(content: string): GuideSnippet[] {
  return [...content.matchAll(/^```([\w-]+)\n([\s\S]*?)\n```/gm)].map(match => ({
    language: match[1], code: match[2], line: content.slice(0, match.index).split('\n').length,
  }));
}
