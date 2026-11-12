import React, { useState, useEffect } from 'react';
import { Wifi, Signal, Battery } from 'lucide-react';

export const AndroidStatusBar: React.FC = () => {
  const [time, setTime] = useState<string>('');

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    };
    updateClock();
    const interval = setInterval(updateClock, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="h-7 bg-slate-950/90 text-white px-5 flex items-center justify-between text-xs select-none shrink-0 z-50">
      <span className="font-semibold tracking-tight text-[11px]">{time || '09:41'}</span>
      <div className="flex items-center gap-2 text-slate-300">
        <Signal className="w-3.5 h-3.5" />
        <span className="text-[10px] font-mono">5G</span>
        <Wifi className="w-3.5 h-3.5" />
        <div className="flex items-center gap-1">
          <span className="text-[10px] font-mono">98%</span>
          <Battery className="w-4 h-4 fill-current text-white" />
        </div>
      </div>
    </div>
  );
};
