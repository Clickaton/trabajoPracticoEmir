export const parseLocalDate = (value) => {
    if (!value) return null;

    if (value instanceof Date) {
        if (Number.isNaN(value.getTime())) return null;
        return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 12, 0, 0);
    }

    const text = String(value).trim();
    const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
        const [, year, month, day] = match.map(Number);
        const date = new Date(year, month - 1, day, 12, 0, 0);
        return Number.isNaN(date.getTime()) ? null : date;
    }

    const date = new Date(text);
    if (Number.isNaN(date.getTime())) return null;
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0);
};

export const parseLocalDateTime = (dateValue, timeValue) => {
    const date = parseLocalDate(dateValue);
    if (!date) return null;

    const [hours, minutes] = String(timeValue || '00:00').split(':').map(Number);
    date.setHours(hours || 0, minutes || 0, 0, 0);
    return date;
};
