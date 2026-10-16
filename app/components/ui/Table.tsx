import React from "react";

export interface Column<T> {
  header: string;
  accessor: keyof T | ((item: T) => React.ReactNode);
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  emptyMessage?: string;
  rowId?: (item: T) => string;
  rowClassName?: (item: T) => string;
}

export function Table<T extends { id: number | string }>({
  columns,
  data,
  emptyMessage = "Aucune donnée disponible",
  rowId,
  rowClassName,
}: TableProps<T>) {
  return (
    <div className="overflow-x-auto border rounded-lg shadow-sm">
      <table className="w-full text-left border-collapse">
        <thead className="bg-gray-100 border-b">
          <tr>
            {columns.map((col, index) => (
              <th
                key={index}
                className="px-4 py-3 text-sm font-semibold text-gray-700"
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="text-center py-6 text-gray-500"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((item) => (
              <tr
                key={item.id}
                id={rowId?.(item)}
                className={`hover:bg-gray-50 transition-colors ${rowClassName?.(item) || ""}`}
              >
                {columns.map((col, index) => (
                  <td key={index} className="px-4 py-3 text-sm text-gray-800">
                    {typeof col.accessor === "function"
                      ? col.accessor(item)
                      : (item[col.accessor] as React.ReactNode)}
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
