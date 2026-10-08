package com.crossword;

import java.util.ArrayDeque; // A queue you can add to at the back and take from the front, both instantly
import java.util.Deque;
import java.util.HashMap;
import java.util.Map;

/*
 * ===== Step 26: Rate limit for Unlimited =====
 *
 * Every unlimited puzzle is one paid Claude API call, and the game is free, so once the site is public
 * someone (or a bot) could press "New puzzle" thousands of times and run up the bill. Two limits:
 *
 *   - per person: at most `perPersonPerHour` puzzles in any 60 minutes (a "person" is an IP address)
 *   - everyone together: at most `everyonePerDay` puzzles in any 24 hours, a hard cap on the daily cost
 *
 * The idea is a "sliding window" (Related LeetCode: 933. Number of Recent Calls, 359. Logger Rate Limiter):
 * keep the times of recent requests in a queue, drop the ones older than the window from the front,
 * and allow a new request only if the queue is still shorter than the limit.
 *
 * The time is passed in (nowMillis) instead of read from the clock, so tests can pretend an hour went by.
 * The daily puzzle doesn't need this: it's generated at most once per difficulty per day (Step 17).
 */
public class RateLimiter {

    static final long HOUR = 60 * 60 * 1000L;   // in milliseconds
    static final long DAY = 24 * HOUR;

    private final int perPersonPerHour;
    private final int everyonePerDay;
    private final Map<String, Deque<Long>> recentByPerson = new HashMap<>();   // IP address -> times of their recent puzzles
    private final Deque<Long> recentForEveryone = new ArrayDeque<>();          // times of everyone's puzzles in the last day

    RateLimiter(int perPersonPerHour, int everyonePerDay) {
        this.perPersonPerHour = perPersonPerHour;
        this.everyonePerDay = everyonePerDay;
    }

    // true = go ahead (and the request is counted); false = over a limit (nothing is counted).
    // "synchronized" because the server answers several requests at the same time (like PuzzleStore.getDaily).
    synchronized boolean allow(String person, long nowMillis) {
        dropOlderThan(recentForEveryone, nowMillis - DAY);
        Deque<Long> theirs = recentByPerson.computeIfAbsent(person, p -> new ArrayDeque<>());
        dropOlderThan(theirs, nowMillis - HOUR);

        if (theirs.size() >= perPersonPerHour || recentForEveryone.size() >= everyonePerDay) {
            return false;
        }
        theirs.addLast(nowMillis);
        recentForEveryone.addLast(nowMillis);

        // Forget people with nothing in the last hour, so the map doesn't grow forever
        recentByPerson.values().removeIf(times -> {
            dropOlderThan(times, nowMillis - HOUR);
            return times.isEmpty();
        });
        return true;
    }

    // Times are added in order, so the oldest is always at the front
    private static void dropOlderThan(Deque<Long> times, long cutoff) {
        while (!times.isEmpty() && times.peekFirst() <= cutoff) {
            times.removeFirst();
        }
    }

    // How many people the limiter is tracking right now (for the tests)
    synchronized int peopleTracked() {
        return recentByPerson.size();
    }
}
