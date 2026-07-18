package com.pbms.modules.infrastructure.utils;

public class LicensePlateUtils {
    /**
     * Normalizes a license plate by converting to uppercase and removing all non-alphanumeric characters.
     * Example: "59-S3 123.45" -> "59S312345"
     */
    public static String normalize(String plate) {
        if (plate == null) return null;
        return plate.toUpperCase().replaceAll("[^A-Z0-9]", "");
    }
}
