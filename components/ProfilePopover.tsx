import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, SmilePlus, Loader2 } from 'lucide-react';

interface ProfilePopoverProps {
  selectedProfile: any;
  selectedPublicProfile: any;
  isLoadingProfile: boolean;
  onClose: () => void;
  onSendMessage: (user: any) => void;
}

const ProfilePopover: React.FC<ProfilePopoverProps> = ({ selectedProfile, selectedPublicProfile, isLoadingProfile, onClose, onSendMessage }) => {
  if (!selectedProfile) return null;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-[280px] shadow-2xl relative"
        onClick={e => e.stopPropagation()}
      >
        <button 
          onClick={onClose}
          className="absolute top-2 right-2 text-slate-500 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>
        
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-full bg-indigo-600 flex items-center justify-center text-2xl font-bold text-white mb-3 shadow-xl border-4 border-slate-800">
            {selectedProfile.name ? selectedProfile.name[0] : '?'}
          </div>
          <h3 className="text-sm font-bold text-white mb-1 flex items-center gap-2">
            {selectedProfile.name || 'Anonymous'}
            {selectedProfile.isPro && (
              <span className="text-[8px] bg-amber-500/20 text-amber-500 px-1 rounded border border-amber-500/30 uppercase font-black">PRO</span>
            )}
          </h3>
          <p className="text-[10px] text-slate-400 italic mb-4">
            {selectedProfile.statusMessage || "No status set"}
          </p>
          
          {/* Professional Details Section */}
          {isLoadingProfile ? (
            <div className="w-full flex justify-center py-4">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
            </div>
          ) : selectedPublicProfile ? (
            <div className="w-full text-left space-y-2 mb-4 border-t border-slate-700/50 pt-3">
              {selectedPublicProfile.title && (
                <div>
                  <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block">Title</span>
                  <span className="text-xs text-slate-300">{selectedPublicProfile.title}</span>
                </div>
              )}
              {selectedPublicProfile.location && (
                <div>
                  <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block">Location</span>
                  <span className="text-xs text-slate-300">{selectedPublicProfile.location}</span>
                </div>
              )}
              {selectedPublicProfile.currentTour && (
                <div>
                  <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block">Current Tour</span>
                  <span className="text-xs text-slate-300">{selectedPublicProfile.currentTour}</span>
                </div>
              )}
              {selectedPublicProfile.specialties && (
                <div>
                  <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block">Specialties</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {(Array.isArray(selectedPublicProfile.specialties) 
                        ? selectedPublicProfile.specialties 
                        : selectedPublicProfile.specialties.split(',')
                    ).map((s: string, i: number) => (
                        <span key={i} className="text-[9px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded border border-slate-700">{s.trim()}</span>
                    ))}
                  </div>
                </div>
              )}
              {selectedPublicProfile.availableForWork && (
                <div className="mt-2 inline-block px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded text-[9px] font-black text-emerald-400 uppercase tracking-widest">
                  Available for Work
                </div>
              )}
            </div>
          ) : (
            <div className="w-full text-center py-2 border-t border-slate-700/50 pt-3">
              <p className="text-[10px] text-slate-500 italic">No public profile available.</p>
            </div>
          )}

          <button
            onClick={() => onSendMessage(selectedProfile)}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <SmilePlus className="w-3 h-3" />
            Send Message
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default ProfilePopover;
