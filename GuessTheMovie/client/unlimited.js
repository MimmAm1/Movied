const serverURL = "http://127.0.0.1:3000";

let currentMovieId = null;
let currentClueIndex = 0;
let clues = [];
let filteredMovies = [];
let correctStreak = parseInt(localStorage.getItem("unlimitedStreak")) || 0;

const guessFieldId = "guess-field";
const submitButtonId = "submit-guess";
const clueBoxId = "clues-box";
const messageBoxId = "message-box";

updateStreakDisplay();

document.addEventListener("DOMContentLoaded", async () => {
    await fetchMovieList();
    setupAutocomplete();
    startGame();

    document.getElementById(submitButtonId).addEventListener("click", submitGuess);

    document.getElementById("next-movie-button").addEventListener("click", () => {
        resetUI();
        startGame();
    });

    document.getElementById("new-game-button").addEventListener("click", () => {
        correctStreak = 0;
        localStorage.setItem("unlimitedStreak", correctStreak);
        updateStreakDisplay();
        resetUI();
        startGame();
    });
});

function updateStreakDisplay() {
    document.getElementById("streak-value").textContent = correctStreak;
}

function showMessage(message, type) {
    const box = document.getElementById(messageBoxId);
    box.innerHTML = message;
    box.className = type;
}

function updateClues() {
    const box = document.getElementById(clueBoxId);
    box.innerHTML = clues.slice(0, currentClueIndex + 1).join("<br>");
}

function resetUI() {
    document.getElementById(guessFieldId).value = "";
    document.getElementById(guessFieldId).disabled = false;
    document.getElementById(submitButtonId).disabled = false;
    document.getElementById(messageBoxId).innerHTML = "";
    document.getElementById(messageBoxId).className = "message-box";
    document.getElementById("next-movie-button").style.display = "none";
    document.getElementById("new-game-button").style.display = "none";
    clues = [];
    currentClueIndex = 0;
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
    const box = document.getElementById("suggestions-box");

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
    try {
        const res = await fetch(`${serverURL}/random-movie`);
        const movie = await res.json();
        currentMovieId = movie.id;
        clues = [movie.clues[0]];
        currentClueIndex = 0;
        updateClues();
        document.getElementById(guessFieldId).focus();
    } catch (err) {
        console.error("Error starting game:", err);
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
            correctStreak++;
            localStorage.setItem("unlimitedStreak", correctStreak);
            updateStreakDisplay();
            document.getElementById("next-movie-button").style.display = "inline-block";
        } else {
            currentClueIndex = result.currentClueIndex;

            if (result.correctAnswer) {
                showMessage(`<i class='fa-solid fa-xmark'></i> <strong>Game over!</strong> The correct answer was: <strong>${result.correctAnswer}</strong>`, "error");
                input.value = userGuess;
                input.disabled = true;
                document.getElementById(submitButtonId).disabled = true;
                correctStreak = 0;
                localStorage.setItem("unlimitedStreak", correctStreak);
                updateStreakDisplay();
                document.getElementById("new-game-button").style.display = "inline-block";
                return;
            }

            if (result.nextClue) {
                clues.push(result.nextClue);
                input.value = "";
                updateClues();
            }

            if (clues.length === 6) {
                showMessage(`<i class='fa-solid fa-masks-theater'></i> <strong>This is your last chance!</strong> Final clue: <strong>Actors</strong>.`, "error");
            } else {
                showMessage(`<i class='fa-solid fa-xmark'></i> <strong>Wrong guess!</strong> Here's another clue.`, "error");
            }
        }
    } catch (err) {
        console.error("Error submitting guess:", err);
        showMessage("An error occurred while checking your guess.", "error");
    }
}