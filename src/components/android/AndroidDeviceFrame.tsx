import React from 'react';

export const AndroidDeviceFrame: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="w-full h-full md:max-w-[412px] md:max-h-[892px] md:mx-auto md:border-[12px] md:border-slate-900 md:rounded-[40px] md:overflow-hidden md:shadow-2xl md:my-10 relative">
      {/* Notch simulation */}
      <div className="hidden md:block absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-slate-900 rounded-b-2xl z-50" />
      {children}
    </div>
  );
};
