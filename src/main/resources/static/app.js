// Schmoll Crossword: draws today's puzzle from the server (Step 19).
// Typing and clicking come in Step 20.

const statusEl = document.getElementById("status");
const puzzleEl = document.getElementById("puzzle");
const boardEl = document.getElementById("board");
const acrossEl = document.getElementById("across-clues");
const downEl = document.getElementById("down-clues");

document.getElementById("puzzle-date").textContent =
    new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });

// Ask the server for today's puzzle at a difficulty, then draw it
async function loadPuzzle(difficulty) {
    statusEl.textContent = "Loading today's " + difficulty + " puzzle… (the first one of the day takes a few seconds)";
    statusEl.classList.remove("error");
    statusEl.hidden = false;
    puzzleEl.hidden = true;

    try {
        const response = await fetch("/api/daily?difficulty=" + encodeURIComponent(difficulty));
        if (!response.ok) {
            throw new Error("The server answered " + response.status);
        }
        const puzzle = await response.json();   // the JSON from Puzzle.toJson()
        drawBoard(puzzle);
        drawClues(puzzle);
        statusEl.hidden = true;
        puzzleEl.hidden = false;
    } catch (err) {
        statusEl.textContent = "Couldn't load the puzzle: " + err.message;
        statusEl.classList.add("error");
    }
}

// One <div> per square. "." in a solution row = black square.
// The letters are NOT shown: the player fills them in (Step 20).
function drawBoard(puzzle) {
    boardEl.innerHTML = "";
    boardEl.style.setProperty("--size", puzzle.size);
    for (let row = 0; row < puzzle.size; row++) {
        for (let col = 0; col < puzzle.size; col++) {
            const cell = document.createElement("div");
            cell.className = "cell";
            cell.dataset.row = row;
            cell.dataset.col = col;
            if (puzzle.solution[row][col] === ".") {
                cell.classList.add("block");
            } else {
                const number = puzzle.numbers[row][col];
                if (number > 0) {
                    const label = document.createElement("span");
                    label.className = "number";
                    label.textContent = number;
                    cell.appendChild(label);
                }
                const letter = document.createElement("span");
                letter.className = "letter";
                cell.appendChild(letter);
            }
            boardEl.appendChild(cell);
        }
    }
}

// "1  Smell like gym socks" for each entry
function drawClues(puzzle) {
    fillClueList(acrossEl, puzzle.across);
    fillClueList(downEl, puzzle.down);
}

function fillClueList(listEl, entries) {
    listEl.innerHTML = "";
    for (const entry of entries) {
        const item = document.createElement("li");
        const number = document.createElement("span");
        number.className = "clue-number";
        number.textContent = entry.number;
        const text = document.createElement("span");
        text.textContent = entry.clue;   // textContent (not innerHTML), so clue text can never inject HTML
        item.append(number, text);
        listEl.appendChild(item);
    }
}

// Difficulty buttons: same grid, different clues
for (const button of document.querySelectorAll(".difficulty button")) {
    button.addEventListener("click", () => {
        document.querySelectorAll(".difficulty button").forEach(b => b.classList.remove("active"));
        button.classList.add("active");
        loadPuzzle(button.dataset.difficulty);
    });
}

loadPuzzle("medium");
