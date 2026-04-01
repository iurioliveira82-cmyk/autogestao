import React from 'react';
import { Table } from './Card';
import { cn } from '../../utils';

interface DataTableProps<T> {
  headers: string[];
  data: T[];
  renderRow: (item: T) => React.ReactNode;
  className?: string;
}

export function DataTable<T>({ headers, data, renderRow, className }: DataTableProps<T>) {
  return (
    <Table headers={headers} className={className}>
      {data.map((item, index) => (
        <React.Fragment key={index}>
          {renderRow(item)}
        </React.Fragment>
      ))}
    </Table>
  );
}
