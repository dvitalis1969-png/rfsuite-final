import { User } from '../types';

export const isPro = (user: User | null | undefined): boolean => {
    if (!user) return false;
    
    // Admin override
    if (user.email === 'dvitalis1969@gmail.com' || user.email === 'dnomsed@live.co.uk') return true;
    if (user.role === 'admin') return true;
    
    return user.subscriptionStatus === 'active';
};
