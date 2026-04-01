import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { toast } from 'sonner';
import { Clock, AlertTriangle } from 'lucide-react';

interface PassCountdownProps {
    user: User | null | undefined;
}

export const PassCountdown: React.FC<PassCountdownProps> = ({ user }) => {
    const [remainingTime, setRemainingTime] = useState<number | null>(null);
    const [hasWarned2Hours, setHasWarned2Hours] = useState(false);
    const [hasWarned1Hour, setHasWarned1Hour] = useState(false);

    useEffect(() => {
        if (!user || !user.expiresAt || user.subscriptionStatus !== 'active') {
            setRemainingTime(null);
            return;
        }

        const expirationDate = new Date(user.expiresAt).getTime();

        const updateCountdown = () => {
            const now = Date.now();
            const diff = expirationDate - now;

            if (diff <= 0) {
                setRemainingTime(0);
                if (user.subscriptionStatus === 'active' && !hasWarned1Hour) {
                    // Slight hack: if it just expired, reload to lock UI
                    window.location.reload();
                }
                return;
            }

            setRemainingTime(diff);

            // 2 hours = 7200000 ms
            // 1 hour = 3600000 ms

            if (diff <= 7200000 && diff > 7190000 && !hasWarned2Hours) {
                toast.warning('2 Hours Remaining', {
                    description: 'You have 2 hours left on your pass. Please save your work.',
                    duration: 10000,
                    icon: <AlertTriangle className="w-5 h-5 text-amber-500" />
                });
                setHasWarned2Hours(true);
            }

            if (diff <= 3600000 && diff > 3590000 && !hasWarned1Hour) {
                toast.error('1 Hour Remaining', {
                    description: 'You have 1 hour left on your pass. Please save your work immediately.',
                    duration: 10000,
                    icon: <AlertTriangle className="w-5 h-5 text-rose-500" />
                });
                setHasWarned1Hour(true);
            }
        };

        updateCountdown();
        const interval = setInterval(updateCountdown, 1000);

        return () => clearInterval(interval);
    }, [user, hasWarned2Hours, hasWarned1Hour]);

    if (remainingTime === null || remainingTime <= 0) return null;

    // Only show if it's a pass (e.g., 48 hours, 7 days, 1 month)
    const isPass = user?.subscription?.toLowerCase().includes('pass') || (remainingTime > 0 && user?.expiresAt);
    
    if (!isPass) return null;

    const days = Math.floor(remainingTime / (1000 * 60 * 60 * 24));
    const hours = Math.floor((remainingTime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((remainingTime % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((remainingTime % (1000 * 60)) / 1000);

    const isUrgent = days === 0 && hours < 2;

    return (
        <div className={`fixed bottom-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl border shadow-2xl backdrop-blur-md transition-all ${
            isUrgent 
                ? 'bg-rose-950/80 border-rose-500/50 text-rose-200' 
                : 'bg-slate-900/80 border-white/10 text-slate-200'
        }`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isUrgent ? 'bg-rose-500/20 text-rose-400' : 'bg-white/5 text-slate-400'}`}>
                <Clock className="w-4 h-4" />
            </div>
            <div>
                <div className="text-[10px] uppercase tracking-widest font-bold opacity-70 mb-0.5">
                    Pass Time Remaining
                </div>
                <div className="font-mono text-lg font-bold tracking-tight">
                    {days > 0 && <span>{days}d </span>}
                    {hours.toString().padStart(2, '0')}:
                    {minutes.toString().padStart(2, '0')}:
                    {seconds.toString().padStart(2, '0')}
                </div>
            </div>
        </div>
    );
};
