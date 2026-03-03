export const exportToJson = (data: any, filename: string) => {
    // Create a deep copy to avoid modifying the original data during serialization if needed
    // For example, Sets might need to be converted to Arrays
    const replacer = (key: string, value: any) => {
        if (value instanceof Set) {
            return Array.from(value);
        }
        return value;
    };

    const json = JSON.stringify(data, replacer, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = filename.endsWith('.json') && !filename.match(/\.rf[a-z]+$/) 
        ? filename 
        : (filename.includes('.') ? filename : `${filename}.json`); // Auto-append extension logic handled by caller mostly
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(href);
};

export const importFromJson = <T>(file: File): Promise<T> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target?.result as string;
                const json = JSON.parse(text, (key, value) => {
                    // Reviver function to handle specific types if we want to auto-convert arrays back to Sets
                    if (key === 'activeFrequencyIds' && Array.isArray(value)) {
                        return new Set(value);
                    }
                    if (key === 'selectedActIds' && Array.isArray(value)) {
                        return value; 
                    }
                    // Dates often come back as strings in JSON
                    if ((key === 'startTime' || key === 'endTime' || key === 'createdAt' || key === 'lastModified') && (typeof value === 'string' || typeof value === 'number')) {
                        const d = new Date(value);
                        if (!isNaN(d.getTime())) return d;
                    }
                    return value;
                });
                resolve(json as T);
            } catch (error) {
                reject(new Error("Failed to parse file. Please ensure it is a valid JSON file."));
            }
        };
        reader.onerror = () => reject(new Error("Failed to read file."));
        reader.readAsText(file);
    });
};