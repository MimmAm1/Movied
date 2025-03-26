const serverURL = "http://127.0.0.1:3000";

let currentMovieId = null;
let currentClueIndex = 0;
let clues = [];
let filteredMovies = [];

const guessFieldId = "daily-guess-field";
const submitButtonId = "daily-submit-guess";
const clueBoxId = "clues-box-d";
const messageBoxId = "message-box-d";

// DOM ready
document.addEventListener("DOMContentLoaded", async () => {
    await fetchMovieList();
    setupAutocomplete();
    startGame();
});

function getTodayKey() {
    return new Date().toISOString().split("T")[0];
}

function getSavedGameState() {
    return JSON.parse(localStorage.getItem("dailyGameState"));
}

function saveGameState(message = "", type = "", finished = false) {
    localStorage.setItem("dailyGameState", JSON.stringify({
        date: getTodayKey(),
        movieId: currentMovieId,
        clues,
        currentClueIndex,
        message,
        messageType: type,
        finished
    }));
}

function showMessage(message, type) {
    const box = document.getElementById(messageBoxId);
    box.innerHTML = message;
    box.className = `message-box ${type}`;
}

function updateClues() {
    const box = document.getElementById(clueBoxId);
    box.innerHTML = clues.slice(0, currentClueIndex + 1).join("<br>");
}

async function fetchMovieList() {
    try {
        const res = await fetch(`${serverURL}/get-movie-list`);
        filteredMovies = await res.json();
    } catch (err) {
        console.error("Error fetching movie list:", err);
    }
}

function setupAutocomplete() {
    const input = document.getElementById(guessFieldId);
    const box = document.getElementById("suggestions-box-d");

    input.addEventListener("input", function () {
        const query = this.value.trim().toLowerCase();
        if (query.length < 2) return (box.innerHTML = "");

        const matches = filteredMovies.filter(m => m.name.toLowerCase().startsWith(query)).slice(0, 10);
        box.innerHTML = matches.map(m => `<div class="suggestion">${m.name}</div>`).join("");

        box.querySelectorAll(".suggestion").forEach(s => {
            s.onclick = () => {
                input.value = s.innerText;
                box.innerHTML = "";
            };
        });
    });

    input.addEventListener("keydown", function (e) {
        const first = document.querySelector(".suggestion");
        if (e.key === "Enter") {
            e.preventDefault();
            if (first) {
                input.value = first.textContent;
                box.innerHTML = "";
            } else {
                document.getElementById(submitButtonId).click();
            }
        }
    });
}

async function startGame() {
    const saved = getSavedGameState();
    const dailyKey = getTodayKey();

    if (saved && saved.date === dailyKey) {
        currentMovieId = saved.movieId;
        clues = saved.clues;
        currentClueIndex = saved.currentClueIndex;
        updateClues();

        if (saved.finished) {
            document.getElementById(guessFieldId).disabled = true;
            document.getElementById(submitButtonId).disabled = true;
            showMessage(saved.message, saved.messageType);
        }
        return;
    }

    try {
        const res = await fetch(`${serverURL}/daily-movie`);
        const movie = await res.json();
        currentMovieId = movie.id;
        clues = [movie.clues[0]];
        currentClueIndex = 0;
        updateClues();
        saveGameState();
    } catch (err) {
        console.error("Failed to start daily game", err);
        document.querySelector(".guess-container").innerHTML = "<p>Failed to load movie.</p>";
    }
}

async function submitGuess() {
    const input = document.getElementById(guessFieldId);
    const userGuess = input.value.trim();
    if (!userGuess) return showMessage("Please enter a movie name!", "error");

    try {
        const res = await fetch(`${serverURL}/guess`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ movieId: currentMovieId, guess: userGuess, currentClueIndex })
        });

        const result = await res.json();

        if (result.success) {
            clues = result.allClues;
            currentClueIndex = clues.length - 1;
            updateClues();
            showMessage(`<i class='fa-solid fa-check'></i> <strong>Correct!</strong> The movie was <strong>${userGuess}</strong>`, "success");
            input.disabled = true;
            document.getElementById(submitButtonId).disabled = true;
            saveGameState(`<i class='fa-solid fa-check'></i> <strong>Correct!</strong> The movie was <strong>${userGuess}</strong>`, "success", true);
        } else {
            currentClueIndex = result.currentClueIndex;
            if (result.correctAnswer) {
                showMessage(`<i class='fa-solid fa-xmark'></i> <strong>Game over!</strong> The correct answer was: <strong>${result.correctAnswer}</strong>`, "error");
                input.disabled = true;
                document.getElementById(submitButtonId).disabled = true;
                saveGameState(`<i class='fa-solid fa-xmark'></i> <strong>Game over!</strong> The correct answer was: <strong>${result.correctAnswer}</strong>`, "error", true);
                return;
            }

            if (result.nextClue) clues.push(result.nextClue);
            updateClues();

            if (clues.length === 6) {
                showMessage(`<i class='fa-solid fa-masks-theater'></i> <strong>Last clue!</strong>`, "error");
            } else {
                showMessage(`<i class='fa-solid fa-xmark'></i> <strong>Wrong guess!</strong> Here's another clue.`, "error");
            }
            saveGameState();
        }
    } catch (err) {
        console.error("Error submitting guess:", err);
        showMessage("An error occurred while checking your guess.", "error");
    }
    input.value = "";
}

document.getElementById(submitButtonId).addEventListener("click", submitGuess);
