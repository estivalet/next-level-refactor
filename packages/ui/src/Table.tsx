import type { ReactNode } from 'react';

/** A plain data table: header labels, rows of cells, and a message when there are no rows. */
export function Table({
  label,
  columns,
  rows,
  empty,
}: {
  label: string;
  columns: readonly string[];
  rows: ReadonlyArray<{ key: string; cells: readonly ReactNode[] }>;
  empty: string;
}) {
  return (
    <table aria-label={label} className="w-full border-collapse text-left text-sm">
      <thead>
        <tr className="border-b border-white/10 text-xs text-slate-400">
          {columns.map((column) => (
            <th key={column} scope="col" className="px-3 py-2 font-medium">
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={columns.length} className="px-3 py-6 text-center text-slate-500">
              {empty}
            </td>
          </tr>
        ) : (
          rows.map((row) => (
            <tr key={row.key} className="border-b border-white/5 hover:bg-white/5">
              {row.cells.map((cell, index) => (
                <td key={index} className="px-3 py-2 align-top text-slate-200">
                  {cell}
                </td>
              ))}
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
