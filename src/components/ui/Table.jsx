import { cls } from '../../lib/utils';

export function Table({ columns, data, onRowClick, emptyMessage = 'No data found.' }) {
  return (
    <div className="overflow-x-auto -mx-5">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100">
            {columns.map((col) => (
              <th
                key={col.key}
                className={cls(
                  'px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap',
                  col.align === 'right' && 'text-right'
                )}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-5 py-8 text-center text-sm text-gray-400">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, i) => (
              <tr
                key={row.id ?? i}
                onClick={() => onRowClick?.(row)}
                className={cls(
                  'border-b border-gray-50 transition-colors',
                  onRowClick && 'cursor-pointer hover:bg-gray-50/80'
                )}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cls(
                      'px-5 py-3 text-gray-700 whitespace-nowrap',
                      col.align === 'right' && 'text-right'
                    )}
                  >
                    {col.render ? col.render(row[col.key], row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
