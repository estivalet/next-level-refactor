const show = (value: unknown) => (value === undefined ? '—' : JSON.stringify(value));

/** Only what changed between before and after: `key: before → after`, one per line. */
export function AuditDiff({ before, after }: { before: unknown; after: unknown }) {
  const isObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);
  if (!isObject(before) || !isObject(after)) {
    return <span className="font-mono text-xs">{`${show(before)} → ${show(after)}`}</span>;
  }
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(
    (key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]),
  );
  return (
    <ul className="flex flex-col gap-0.5 font-mono text-xs">
      {keys.map((key) => (
        <li key={key}>{`${key}: ${show(before[key])} → ${show(after[key])}`}</li>
      ))}
    </ul>
  );
}
