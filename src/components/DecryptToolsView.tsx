import React from 'react';
import { User } from '../types';

interface DecryptToolsViewProps {
  currentUser: User | null;
}

export const DecryptToolsView: React.FC<DecryptToolsViewProps> = ({ currentUser }) => {
  return (
    <div className="p-6 bg-white rounded-2xl border border-gray-200">
      <h2 className="text-xl font-bold mb-4">문서 암호 해제 도구</h2>
      <p className="text-gray-600">암호가 걸린 문서의 비밀번호를 확인하거나 해제할 수 있습니다.</p>
      {/* Decryption logic will go here */}
    </div>
  );
};
