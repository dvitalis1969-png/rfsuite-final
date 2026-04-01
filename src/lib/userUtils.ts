import { User } from '../../types';

export const isPro = (user: User | null | undefined): boolean => {
    if (!user) {
        console.log("isPro: No user object provided");
        return false;
    }
    
    const userEmail = user.email?.toLowerCase().trim();
    const isAdminEmail = 
        userEmail === 'dvitalis1969@gmail.com' || 
        userEmail === 'dnomsed@live.co.uk' || 
        userEmail === 'aniakwlk@yahoo.co.uk';
    
    // Admin override
    if (isAdminEmail) {
        console.log(`isPro: Admin override for ${userEmail}`);
        return true;
    }
    
    if (user.role === 'admin') {
        console.log(`isPro: Role override for ${userEmail}`);
        return true;
    }
    
    let isProUser = user.subscriptionStatus === 'active';
    
    // Check expiration if it exists
    if (isProUser && user.expiresAt) {
        const expirationDate = new Date(user.expiresAt).getTime();
        const now = Date.now();
        if (now > expirationDate) {
            isProUser = false;
        }
    }

    if (!isProUser) {
        console.log(`isPro: User ${userEmail} is not Pro. Status: ${user.subscriptionStatus}, Expires: ${user.expiresAt}`);
    } else {
        console.log(`isPro: User ${userEmail} is Pro. Status: ${user.subscriptionStatus}, Expires: ${user.expiresAt}`);
    }
    return isProUser;
};
