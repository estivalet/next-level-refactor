import type { MenuDocNode } from '@nextlevel/shared';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { INPUT } from '../library/Modal.tsx';
import type { MenuRefs } from './nodeStatus.ts';
import type { NodePatch } from './treeOps.ts';

const LABEL = 'block text-[11px] text-slate-400';

/** The selected node's fields (FR-MENU-2/4). No theme field yet (D9). Remount per node (`key`). */
export function NodeForm({
  node,
  refs,
  onPatch,
}: {
  node: MenuDocNode;
  refs: MenuRefs | null;
  onPatch: (patch: NodePatch) => void;
}) {
  const { t } = useTranslation();
  return (
    <form
      className="space-y-3 p-3 text-xs"
      onSubmit={(event) => {
        event.preventDefault();
      }}
    >
      <p className="text-slate-500">{t(`menuEditor.kind.${node.type}`)}</p>
      {node.type !== 'category' && refs && (
        <TargetField node={node} refs={refs} onPatch={onPatch} />
      )}
      <TextField
        label={t('menuEditor.form.name')}
        hint={node.type === 'category' ? undefined : t('menuEditor.form.nameHint')}
        value={node.name}
        required
        onCommit={(name) => {
          onPatch({ name: name ?? node.name });
        }}
      />
      <TextField
        label={t('menuEditor.form.displayName')}
        value={node.displayName ?? ''}
        onCommit={(displayName) => {
          onPatch({ displayName });
        }}
      />
      <TextField
        label={t('menuEditor.form.shortName')}
        value={node.shortName ?? ''}
        onCommit={(shortName) => {
          onPatch({ shortName });
        }}
      />
      {node.type === 'system' && (
        <Check
          label={t('menuEditor.form.filterTabs')}
          checked={node.filterTabs}
          onChange={(filterTabs) => {
            onPatch({ filterTabs });
          }}
        />
      )}
      <Check
        label={t('menuEditor.form.visible')}
        checked={node.visible}
        onChange={(visible) => {
          onPatch({ visible });
        }}
      />
    </form>
  );
}

/** Points a reference at another target; a name that was the old target's name follows. */
function TargetField({
  node,
  refs,
  onPatch,
}: {
  node: MenuDocNode;
  refs: MenuRefs;
  onPatch: (patch: NodePatch) => void;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const options: Array<[string, string]> =
    node.type === 'system'
      ? [...refs.systems].map(([id, s]) => [id, s.name])
      : [...(node.type === 'collection' ? refs.collections : refs.smartFilters)].map(([id, x]) => [
          String(id),
          x.name,
        ]);
  const current = options.find(([id]) => id === node.refId);
  const q = query.trim().toLowerCase();
  const shown = options.filter(([id, name]) => id === node.refId || name.toLowerCase().includes(q));
  return (
    <div className="space-y-1">
      <input
        type="search"
        aria-label={t('menuEditor.form.findTarget')}
        placeholder={t('menuEditor.form.findTarget')}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
        }}
        className={INPUT}
      />
      <select
        aria-label={t('menuEditor.form.target')}
        value={node.refId ?? ''}
        onChange={(event) => {
          const next = options.find(([id]) => id === event.target.value);
          if (!next) return;
          const followName = !current || node.name === current[1];
          onPatch({ refId: next[0], ...(followName ? { name: next[1] } : {}) });
        }}
        className={INPUT}
      >
        {!current && <option value={node.refId ?? ''}>{t('menuEditor.form.deletedTarget')}</option>}
        {shown.map(([id, name]) => (
          <option key={id} value={id}>
            {name}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Commits on Enter or leaving the field; empty means null (or, when required, no change). */
function TextField(props: {
  label: string;
  hint?: string | undefined;
  value: string;
  required?: boolean;
  onCommit: (value: string | null) => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const [value, setValue] = useState(props.value);
  // The node can change under the field (retarget, undo, F2 in the tree): show the new value.
  const [shown, setShown] = useState(props.value);
  if (shown !== props.value) {
    setShown(props.value);
    setValue(props.value);
  }
  const missing = props.required === true && value.trim() === '';
  const commit = () => {
    const trimmed = value.trim();
    if (trimmed === props.value || (missing && props.required)) return;
    props.onCommit(trimmed === '' ? null : trimmed);
  };
  return (
    <div>
      <label htmlFor={id} className={LABEL}>
        {props.label}
      </label>
      <input
        id={id}
        className={INPUT}
        value={value}
        maxLength={200}
        aria-invalid={missing}
        onChange={(event) => {
          setValue(event.target.value);
        }}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit();
        }}
      />
      {missing && (
        <p className="mt-0.5 text-[11px] text-red-300">{t('menuEditor.form.nameRequired')}</p>
      )}
      {props.hint && !missing && <p className="mt-0.5 text-[11px] text-slate-500">{props.hint}</p>}
    </div>
  );
}

function Check({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-slate-300">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => {
          onChange(event.target.checked);
        }}
      />
      {label}
    </label>
  );
}
