package com.crossword;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

// Step 26: the sliding-window rate limit. Times are made up, so "an hour later" takes no time at all.
class RateLimiterTest {

    private static final long HOUR = RateLimiter.HOUR;

    @Test
    void allowsUpToTheLimitPerPerson() {
        RateLimiter limiter = new RateLimiter(3, 100);
        assertTrue(limiter.allow("alice", 0));
        assertTrue(limiter.allow("alice", 1000));
        assertTrue(limiter.allow("alice", 2000));
        assertFalse(limiter.allow("alice", 3000), "4th within the hour");
        assertTrue(limiter.allow("bob", 3000), "someone else has their own allowance");
    }

    @Test
    void oldRequestsSlideOutOfTheWindow() {
        RateLimiter limiter = new RateLimiter(2, 100);
        assertTrue(limiter.allow("alice", 0));
        assertTrue(limiter.allow("alice", 10 * 60 * 1000));       // 10 minutes later
        assertFalse(limiter.allow("alice", 30 * 60 * 1000));      // 30 minutes: still 2 in the last hour
        assertTrue(limiter.allow("alice", HOUR + 1), "the first one is now over an hour old");
        assertFalse(limiter.allow("alice", HOUR + 2), "the 10-minute one still counts");
    }

    @Test
    void refusedRequestsDontCount() {
        RateLimiter limiter = new RateLimiter(1, 100);
        assertTrue(limiter.allow("alice", 0));
        for (int i = 1; i <= 50; i++) {
            assertFalse(limiter.allow("alice", i * 60 * 1000));   // hammering it doesn't push the wait back
        }
        assertTrue(limiter.allow("alice", HOUR + 1));
    }

    @Test
    void everyoneTogetherHasADailyCap() {
        RateLimiter limiter = new RateLimiter(10, 3);
        assertTrue(limiter.allow("a", 0));
        assertTrue(limiter.allow("b", 0));
        assertTrue(limiter.allow("c", 0));
        assertFalse(limiter.allow("d", 0), "a 4th person is over the daily cap");
        assertFalse(limiter.allow("d", 23 * HOUR));
        assertTrue(limiter.allow("d", 24 * HOUR + 1), "a day later there's room again");
    }

    @Test
    void forgetsPeopleAfterAnHour() {
        RateLimiter limiter = new RateLimiter(5, 100);
        limiter.allow("a", 0);
        limiter.allow("b", 0);
        assertEquals(2, limiter.peopleTracked());
        limiter.allow("c", 2 * HOUR);
        assertEquals(1, limiter.peopleTracked(), "only c is left");
    }

    // Unlimited (since 2026-10-08): 10 per person per DAY, and the website can ask how many are left
    @Test
    void aDailyWindowCountsWhatsLeft() {
        long DAY = RateLimiter.DAY;
        RateLimiter limiter = new RateLimiter(3, DAY, 100);
        assertEquals(3, limiter.remaining("me", 0));
        assertTrue(limiter.allow("me", 0));
        assertTrue(limiter.allow("me", HOUR));
        assertEquals(1, limiter.remaining("me", 2 * HOUR));
        assertEquals(0, limiter.secondsUntilNext("me", 2 * HOUR), "still has one left");
        assertTrue(limiter.allow("me", 3 * HOUR));
        assertFalse(limiter.allow("me", 5 * HOUR), "an hour later isn't enough any more");
        assertEquals(0, limiter.remaining("me", 5 * HOUR));
        assertEquals((DAY - 5 * HOUR) / 1000, limiter.secondsUntilNext("me", 5 * HOUR), "the first one comes back 24 hours after it was made");
        assertEquals(1, limiter.remaining("me", DAY + 1));
        assertEquals(3, limiter.limit());
    }
}
