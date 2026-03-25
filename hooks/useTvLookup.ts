import { useState } from 'react';
import { TVChannelState } from '../types';

export const useTvLookup = (
    tvRegion: 'uk' | 'us',
    setTvStates: (states: Record<number, TVChannelState>) => void,
    setActiveTransmitters: (transmitters: string[]) => void
) => {
    const [isLocating, setIsLocating] = useState(false);
    const [tvChannelErpData, setTvChannelErpData] = useState<Record<number, { maxErp: number, transmitterName: string }>>({});

    const handleLookup = async (lat: number, lng: number) => {
        setIsLocating(true);
        try {
            const response = await fetch(`/api/lookup/${tvRegion}-tv?lat=${lat}&lng=${lng}`);
            const data = await response.json();
            
            if (data && data.occupied) {
                const next: Record<number, TVChannelState> = {};
                
                if (data.transmitters) {
                    setActiveTransmitters(data.transmitters.map((t: any) => t.name));
                }
                
                setTvChannelErpData(data.occupied);
                
                Object.keys(data.occupied).forEach((ch: string) => {
                    next[Number(ch)] = 'blocked';
                });
                
                setTvStates(next);
            }
        } catch (err) {
            console.error("Lookup error:", err);
            alert("Failed to lookup TV transmitters for this location.");
        } finally {
            setIsLocating(false);
        }
    };

    return { handleLookup, isLocating, tvChannelErpData, setTvChannelErpData };
};
