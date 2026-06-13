/**
 * Anthropic tool names must match ^[a-zA-Z0-9_-]{1,128}$ (no dots). Promus tool
 * names are `namespace.method` (memory.save, browser.navigate), so map every
 * illegal char to '_' when presenting them to the API.
 *
 * The transform is lossy (a literal '_' in a method name like `agent.contact_add`
 * is indistinguishable from a mapped '.'), so to reverse it, match
 * `sanitizeToolName(registeredName) === incomingName` against the registry's
 * real names rather than de-sanitizing the incoming string.
 */
export function sanitizeToolName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, '_')
}
