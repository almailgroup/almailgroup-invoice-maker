/** Replaces {placeholders} in an email template. Unknown ones are left as is. */
export function fillTemplate(template: string, values: Record<string, string>): string {
  return template
    .replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? values[key] : match))
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Builds a mailto: link. Line breaks are sent as CRLF for maximum compatibility. */
export function mailtoLink({
  to,
  cc = [],
  subject,
  body,
}: {
  to: string[];
  cc?: string[];
  subject: string;
  body: string;
}): string {
  const params = [
    `subject=${encodeURIComponent(subject)}`,
    `body=${encodeURIComponent(body.replace(/\r?\n/g, '\r\n'))}`,
  ];
  if (cc.length) params.push(`cc=${cc.map(encodeURIComponent).join(',')}`);
  return `mailto:${to.map(encodeURIComponent).join(',')}?${params.join('&')}`;
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
