import React, { ReactNode } from "react";

interface CardProps {
  className?: string;
  children: ReactNode;
}

export const Card: React.FC<CardProps> = ({ children, className }) => {
  return (
    <div className={`bg-white p-4 rounded-lg shadow-lg ${className}`}>
      {children}
    </div>
  );
};

export const CardContent: React.FC<{ children: ReactNode; className?: string }> = ({ children, className }) => {
  return <div className={className}>{children}</div>;
};
