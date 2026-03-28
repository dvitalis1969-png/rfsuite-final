import { User } from '../types';

export const isPro = (user: User | null | undefined): boolean => {
    return user?.subscriptionStatus === 'active';
};
