# Step 26: how a hosting service builds and runs Schmoll Crossword.
# A Dockerfile is a recipe for a "container": a small Linux machine with exactly what the app needs.
# Two stages: the first has Maven and builds the jar, the second only has Java and runs it (smaller, safer).

# ---- Stage 1: build ----
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn -q dependency:go-offline          # download libraries first, so Docker can reuse them when only code changes
COPY src ./src
# Tests run on your computer (mvn test) before you push; skipping them here keeps deploys fast and avoids
# timing tests failing on a slow build machine.
RUN mvn -q package -DskipTests

# ---- Stage 2: run ----
FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /app/target/crossword-backend-1.0-SNAPSHOT.jar app.jar

# The daily puzzle changes at midnight in THIS time zone (the server's date picks the daily).
# Change it if most players live somewhere else.
ENV TZ=America/New_York
# Where daily puzzles are saved. Attach a persistent disk here on the host, or a restart loses today's clues.
ENV PUZZLE_DIR=/data

# The Claude API key is NOT in here. Set it as a secret environment variable in the host's dashboard.

EXPOSE 8080
# MaxRAMPercentage: let Java use most of the container's memory, but not more than it has
CMD ["java", "-XX:MaxRAMPercentage=75", "-jar", "app.jar"]
