package com.crossword;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

/*
 * The developer's key for the admin tools (reading reports, hiding a name, switching a puzzle off, the status
 * dashboard). The host sets ADMIN_KEY (REPORTS_KEY still works); without one, every admin page answers 404, as if
 * it didn't exist. The key travels in the X-Admin-Key header, never in a URL, so it can't end up in access logs.
 */
final class AdminKey {

    private AdminKey() {}

    static String configured() {
        String key = System.getenv("ADMIN_KEY");
        if (key == null || key.isBlank()) key = System.getenv("REPORTS_KEY");
        return key == null || key.isBlank() ? null : key.trim();
    }

    // Constant-time comparison, so the time an answer takes doesn't hint at how much of a guess was right
    static boolean matches(String configured, String given) {
        if (configured == null || configured.isBlank() || given == null) return false;
        return MessageDigest.isEqual(configured.getBytes(StandardCharsets.UTF_8), given.trim().getBytes(StandardCharsets.UTF_8));
    }

    static void require(String configured, String given) {
        if (!matches(configured, given)) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
    }
}
