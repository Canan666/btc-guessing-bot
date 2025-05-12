import React from 'react';

export const Table: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <table className="min-w-full bg-white border border-gray-300 rounded-lg">
      {children}
    </table>
  );
};

export const TableHeader: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <thead className="bg-gray-100">{children}</thead>;
};

export const TableBody: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <tbody>{children}</tbody>;
};

export const TableRow: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <tr className="border-b border-gray-200">{children}</tr>;
};

export const TableCell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <td className="px-4 py-2 text-sm text-gray-600">{children}</td>;
};
