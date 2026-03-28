import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { HelpCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface InfoTooltipProps {
  content: React.ReactNode;
  size?: number;
}

export const InfoTooltip: React.FC<InfoTooltipProps> = ({ content, size = 14 }) => {
  const [isVisible, setIsVisible] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0 });

  const updateCoords = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setCoords({
        top: rect.top,
        left: rect.left + rect.width / 2,
      });
    }
  };

  useEffect(() => {
    if (isVisible) {
      updateCoords();
      // Use capture: true to catch scroll events from any parent container
      window.addEventListener('scroll', updateCoords, { passive: true, capture: true });
      window.addEventListener('resize', updateCoords);

      const handleClickOutside = (e: MouseEvent) => {
        if (triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
          setIsVisible(false);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        window.removeEventListener('scroll', updateCoords, { capture: true } as any);
        window.removeEventListener('resize', updateCoords);
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isVisible]);

  return (
    <div 
      ref={triggerRef}
      className="relative inline-flex items-center ml-1"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onClick={() => setIsVisible(!isVisible)}
    >
      <HelpCircle size={size} className="text-slate-400 hover:text-indigo-400 cursor-help transition-colors" />
      
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {isVisible && (
            <motion.div 
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              style={{
                position: 'fixed',
                top: coords.top,
                left: Math.max(160, Math.min(window.innerWidth - 160, coords.left)),
                transform: 'translate(-50%, -100%)',
                zIndex: 10000,
                marginTop: '-12px',
                width: 'max-content',
                maxWidth: 'min(320px, 80vw)',
              }}
              className="p-3 bg-slate-800 text-slate-200 text-xs rounded-xl shadow-2xl border border-slate-700 pointer-events-none leading-relaxed"
            >
              {content}
              <div 
                className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-[6px] border-transparent border-t-slate-700" 
                style={{ 
                  left: `calc(50% + ${coords.left - Math.max(120, Math.min(window.innerWidth - 120, coords.left))}px)` 
                }}
              />
              <div 
                className="absolute top-full left-1/2 -translate-x-1/2 -mt-[1px] border-[5px] border-transparent border-t-slate-800"
                style={{ 
                  left: `calc(50% + ${coords.left - Math.max(120, Math.min(window.innerWidth - 120, coords.left))}px)` 
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
};
