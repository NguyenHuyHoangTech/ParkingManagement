import React from 'react';
import { Spin } from 'antd';

export const GlobalLoading: React.FC = () => {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-gray-50/50">
      <Spin size="large" tip="Loading data..." />
    </div>
  );
};
