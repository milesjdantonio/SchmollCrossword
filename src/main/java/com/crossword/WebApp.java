package com.crossword;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/*
 * ===== Step 18: The web server =====
 *
 * Starts Schmoll Crossword's website server on http://localhost:8080
 *   Run it:  mvn spring-boot:run      (stop it with Ctrl+C)
 *
 * @SpringBootApplication tells Spring Boot to look through this package for classes marked
 * @RestController (like PuzzleController) and hook their URLs up to the server automatically.
 *
 * App.main is still your PASS/FAIL test runner; this is a separate starting point just for the website.
 */
@SpringBootApplication
public class WebApp {
    public static void main(String[] args) {
        SpringApplication.run(WebApp.class, args);
    }
}
