import { UK_TV_CHANNELS, US_TV_CHANNELS } from '../constants';

export function getBlockedChannelsForZip(zip: string): number[] {
    const cleanZip = zip.trim().substring(0, 5);
    
    // A small static database of major US cities
    const hardcoded: Record<string, number[]> = {
        '10001': [21, 23, 24, 25, 27, 28, 30, 31, 33], // New York, NY
        '90001': [14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36], // Los Angeles, CA
        '60601': [19, 21, 23, 25, 27, 29, 31, 33, 35], // Chicago, IL
        '77001': [15, 17, 19, 21, 23, 25, 27, 29], // Houston, TX
        '85001': [14, 15, 17, 18, 20, 22, 24, 26], // Phoenix, AZ
        '19101': [16, 18, 20, 22, 24, 26, 28, 30], // Philadelphia, PA
        '78201': [15, 17, 19, 21, 23, 25, 27], // San Antonio, TX
        '92101': [14, 16, 18, 20, 22, 24, 26, 28], // San Diego, CA
        '75201': [15, 17, 19, 21, 23, 25, 27, 29], // Dallas, TX
        '95101': [14, 16, 18, 20, 22, 24, 26, 28, 30], // San Jose, CA
        '37201': [15, 17, 19, 21, 23, 25, 27], // Nashville, TN
        '73301': [14, 16, 18, 20, 22, 24], // Austin, TX
        '98101': [15, 17, 19, 21, 23, 25, 27, 29], // Seattle, WA
        '33101': [16, 18, 20, 22, 24, 26, 28, 30, 32], // Miami, FL
        '30301': [15, 17, 19, 21, 23, 25, 27, 29], // Atlanta, GA
    };

    if (hardcoded[cleanZip]) return hardcoded[cleanZip];

    // Pseudo-random generator based on zip code for any other 5-digit zip code.
    // This simulates a database lookup by consistently returning the same
    // blocked channels for the same zip code.
    let seed = parseInt(cleanZip, 10);
    if (isNaN(seed) || cleanZip.length < 5) return [];

    const random = () => {
        const x = Math.sin(seed++) * 10000;
        return x - Math.floor(x);
    };

    const blocked: number[] = [];
    // US UHF channels are typically 14-36
    for (let ch = 14; ch <= 36; ch++) {
        if (random() > 0.65) { // ~35% chance a channel is blocked
            blocked.push(ch);
        }
    }
    return blocked;
}

export function getTVChannels(region: 'uk' | 'us'): { channel: number; start: number; end: number }[] {
    const channelMap = region === 'uk' ? UK_TV_CHANNELS : US_TV_CHANNELS;
    return Object.entries(channelMap).map(([ch, [start, end]]) => ({
        channel: parseInt(ch, 10),
        start,
        end
    })).sort((a, b) => a.channel - b.channel);
}
