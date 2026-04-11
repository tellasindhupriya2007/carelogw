/**
 * Generates a unique, human-readable Patient ID.
 * Format: CL-[YYYY]-[4 random digits]
 * Example: CL-2024-4821
 */
export const generatePatientId = () => {
    const year = new Date().getFullYear();
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluded similar I/1, O/0
    let suffix = '';
    for (let i = 0; i < 6; i++) {
        suffix += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `CL-${year}-${suffix}`;
};
