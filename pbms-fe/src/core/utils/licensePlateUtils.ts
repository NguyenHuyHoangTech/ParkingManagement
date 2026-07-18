/**
 * Normalizes a license plate by converting to uppercase and removing all non-alphanumeric characters.
 * Example: "59-S3 123.45" -> "59S312345"
 */
export const normalizePlateNumber = (plate: string | undefined | null): string => {
    if (!plate) return '';
    return plate.toUpperCase().replace(/[^A-Z0-9]/g, '');
};
