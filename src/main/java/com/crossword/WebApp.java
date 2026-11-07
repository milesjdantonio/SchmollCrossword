package com.crossword;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

/*
 * Starts Schmoll Crossword's website server on http://localhost:8080 (mvn spring-boot:run).
 * Spring Boot finds the @RestController classes in this package and serves the website from static/.
 * Scheduling runs the background jobs (DailyMaker makes dailies ahead of time).
 */
@SpringBootApplication
@EnableScheduling
public class WebApp {
    public static void main(String[] args) {
        SpringApplication.run(WebApp.class, args);
    }
}
