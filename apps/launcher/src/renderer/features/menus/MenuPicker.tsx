import type { MenuSummary } from '@nextlevel/shared';
import { CheckCircle2, Copy, Eye, Plus, Save, Trash2, Undo2 } from 'lucide-react';
import type { ElementType } from 'react';
import { useTranslation } from 'react-i18next';

const BUTTON =
  'flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-xs text-slate-300 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40';

export interface MenuPickerProps {
  menus: readonly MenuSummary[];
  /** The menu being edited. */
  menuId: string | null;
  /** Title of the generated menu while nothing is stored (FR-MENU-3); null once stored. */
  unsavedTitle: string | null;
  dirty: boolean;
  saving: boolean;
  canUndo: boolean;
  canSave: boolean;
  onPick: (id: string) => void;
  onNew: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onSetActive: () => void;
  onUndo: () => void;
  onSave: () => void;
  onPreview?: () => void;
}

/** The Menu Editor header (S10): which menu, and what to do with it. */
export function MenuPicker(props: MenuPickerProps) {
  const { t } = useTranslation();
  const current = props.menus.find((menu) => menu.id === props.menuId);
  const action = (Icon: ElementType, label: string, onClick: () => void, disabled = false) => (
    <button type="button" className={BUTTON} disabled={disabled} onClick={onClick}>
      <Icon aria-hidden="true" className="h-3.5 w-3.5" />
      {label}
    </button>
  );
  return (
    <header className="flex flex-wrap items-center gap-2 border-b border-white/5 px-3 py-2">
      <select
        aria-label={t('menuEditor.picker.label')}
        value={props.menuId ?? ''}
        disabled={props.saving}
        onChange={(event) => {
          props.onPick(event.target.value);
        }}
        className="max-w-56 rounded-md border border-white/10 bg-black/40 px-2 py-1 text-xs text-white"
      >
        {props.unsavedTitle !== null && (
          <option value={props.menuId ?? ''}>
            {t('menuEditor.picker.unsaved', { title: props.unsavedTitle })}
          </option>
        )}
        {props.menus.map((menu) => (
          <option key={menu.id} value={menu.id}>
            {menu.active ? t('menuEditor.picker.active', { title: menu.title }) : menu.title}
          </option>
        ))}
      </select>
      {props.dirty && (
        <span
          role="img"
          aria-label={t('menuEditor.unsaved')}
          title={t('menuEditor.unsaved')}
          className="h-2 w-2 rounded-full bg-amber-400"
        />
      )}
      {action(Plus, t('menuEditor.picker.new'), props.onNew)}
      {action(Copy, t('menuEditor.picker.duplicate'), props.onDuplicate)}
      {action(Trash2, t('menuEditor.picker.delete'), props.onDelete, !current)}
      {action(
        CheckCircle2,
        t('menuEditor.picker.setActive'),
        props.onSetActive,
        !current || current.active || props.dirty,
      )}
      <div className="ml-auto flex items-center gap-2">
        {action(Undo2, t('menuEditor.undo'), props.onUndo, !props.canUndo)}
        {props.onPreview && action(Eye, t('menuEditor.preview'), props.onPreview)}
        {action(Save, t('menuEditor.save'), props.onSave, !props.canSave)}
      </div>
    </header>
  );
}
