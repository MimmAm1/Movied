const serverURL = "http://127.0.0.1:3000";

let currentMovieId = null;
let currentClueIndex = 0;
let clues = [];

document.addEventListener("DOMContentLoaded", async () => {
    await loadPastDailies();

    document.getElementById("archive-submit-guess").addEventListener("click", submitGuess);
});

async function loadPastDailies() {
    try {
        const response = await fetch(`${serverURL}/past-daily-challenges`);
        const titles = await response.json();

        const container = document.getElementById("past-dailies-container");
        container.innerHTML = "";

        titles.forEach((_, index) => {
            const btn = document.createElement("button");
            btn.textContent = `${index + 1}`;
            btn.className = "submit-guess"; // reuse styling
            btn.addEventListener("click", () => startPastGame(index));
            container.appendChild(btn);
        });
    } catch (error) {
        console.error("Error loading past dailies:", error);
    }
}

async function startPastGame(dayIndex) {
    try {
        const response = await fetch(`${serverURL}/past-daily-challenges`);
        const titles = await response.json();
        const title = titles[dayIndex];

        const movieRes = await fetch(`${serverURL}/get-movie-by-title`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title })
        });

        if (!movieRes.ok) throw new Error("Movie not found.");

        const movie = await movieRes.json();
        currentMovieId = movie.id;
        clues = [movie.clues[0]];
        currentClueIndex = 0;

        document.getElementById("archive-game").style.display = "block";
        document.getElementById("archive-clues-box").innerHTML = "";
        document.getElementById("archive-message-box").innerHTML = "";
        document.getElementById("archive-guess-field").value = "";
        document.getElementById("archive-guess-field").disabled = false;
        document.getElementById("archive-submit-guess").disabled = false;

        updateClues();
    } catch (error) {
        showMessage("Failed to load movie.", "error");
        console.error("Error starting past game:", error);
    }
}

function updateClues() {
    const clueBox = document.getElementById("archive-clues-box");
    clueBox.innerHTML = clues.slice(0, currentClueIndex + 1).join("<br>");
}

async function submitGuess() {
    const guessInput = document.getElementById("archive-guess-field");
    const guess = guessInput.value.trim();

    if (!guess) {
        showMessage("Please enter a guess!", "error");
        return;
    }

    try {
        const response = await fetch(`${serverURL}/guess`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ movieId: currentMovieId, guess, currentClueIndex })
        });

        const result = await response.json();

        if (result.success) {
            clues = result.allClues;
            currentClueIndex = clues.length - 1;
            updateClues();
            showMessage(`<i class="fa-solid fa-check"></i> Correct! The movie was <strong>${guess}</strong>`, "success");
            disableInputs();
        } else {
            currentClueIndex = result.currentClueIndex;

            if (result.correctAnswer) {
                clues = result.allClues;
                currentClueIndex = clues.length - 1;
                updateClues();
                showMessage(`<i class="fa-solid fa-xmark"></i> Game over! The correct answer was <strong>${result.correctAnswer}</strong>`, "error");
                disableInputs();
                return;
            }

            if (result.nextClue) clues.push(result.nextClue);

            updateClues();

            if (clues.length === 6) {
                showMessage("🎭 Last clue! Final chance.", "error");
            } else {
                showMessage(`<i class="fa-solid fa-xmark"></i> Wrong! Here's another clue.`, "error");
            }
        }
    } catch (error) {
        console.error("Error submitting guess:", error);
        showMessage("An error occurred while checking your guess.", "error");
    }

    guessInput.value = "";
}

function disableInputs() {
    document.getElementById("archive-guess-field").disabled = true;
    document.getElementById("archive-submit-guess").disabled = true;
}

function showMessage(message, type) {
    const box = document.getElementById("archive-message-box");
    box.innerHTML = message;
    box.className = `message-box ${type}`;
}
