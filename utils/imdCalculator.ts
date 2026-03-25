import { Frequency, Thresholds } from '../types';

export interface IMDProduct {
    freq: number;
    type: '2-Tone' | '3-Tone';
    sources: Frequency[];
}

export const calculateIMD = (frequencies: Frequency[], thresholds: Thresholds): IMDProduct[] => {
    const products: IMDProduct[] = [];
    const validFreqs = frequencies.filter(f => f.value > 0);
    
    if (validFreqs.length < 2) return products;

    // 2-Tone IMD
    for (let i = 0; i < validFreqs.length; i++) {
        for (let j = 0; j < validFreqs.length; j++) {
            if (i === j) continue;
            const product = 2 * validFreqs[i].value - validFreqs[j].value;
            products.push({ freq: product, type: '2-Tone', sources: [validFreqs[i], validFreqs[j]] });
        }
    }

    // 3-Tone IMD
    for (let i = 0; i < validFreqs.length; i++) {
        for (let j = 0; j < validFreqs.length; j++) {
            if (i === j) continue;
            for (let k = 0; k < validFreqs.length; k++) {
                if (k === i || k === j) continue;
                const product = validFreqs[i].value + validFreqs[j].value - validFreqs[k].value;
                products.push({ freq: product, type: '3-Tone', sources: [validFreqs[i], validFreqs[j], validFreqs[k]] });
            }
        }
    }

    return products;
};
