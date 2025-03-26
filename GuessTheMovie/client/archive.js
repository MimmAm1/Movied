const serverURL = "http://127.0.0.1:3000";

let currentMovieId = null;
let currentClueIndex = 0;
let clues = [];
let filteredMovies = [];
let pastMovies = [];

document.addEventListener("DOMContentLoaded", async () => {

    await fetchMovieList();
    await loadPastDailies();

    document.getElementById("archive-submit-guess").addEventListener("click", submitGuess);
    document.getElementById("archive-guess-field").addEventListener("input", handleAutocomplete);

    document.getElementById("go-back-button").addEventListener("click", () => {
        document.getElementById("archive-game").style.display = "none";
        document.getElementById("go-back-button").style.display = "none";
        document.getElementById("past-dailies-container").style.display = "flex";
    });
});

async function fetchMovieList() {
    try {
        const response = await fetch(`${serverURL}/get-movie-list`);
        filteredMovies = await response.json();
    } catch (error) {
        console.error("Error fetching movie list:", error);
    }
}

async function loadPastDailies() {
    try {
        const response = await fetch(`${serverURL}/past-daily-challenges`);
        pastMovies = await response.json();

        const container = document.getElementById("past-dailies-container");
        container.innerHTML = "";

        pastMovies.forEach((movie, index) => {
            const btn = document.createElement("button");
            btn.textContent = `${index + 1}`;
            btn.className = "past-daily-btn";
            btn.addEventListener("click", () => startPastGame(movie.id));
            container.appendChild(btn);
        });
    } catch (error) {
        console.error("Error loading past dailies:", error);
    }
}

async function startPastGame(id) {
    try {
        const response = await fetch(`${serverURL}/get-movie-by-id`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id })
        });

        if (!response.ok) throw new Error("Failed to fetch past movie");

        const movie = await response.json();
        currentMovieId = movie.id;
        clues = [movie.clues[0]];
        currentClueIndex = 0;

        // Hide challenge buttons
        document.getElementById("past-dailies-container").style.display = "none";

        // Show game and back button
        document.getElementById("archive-game").style.display = "flex";
        document.getElementById("go-back-button").style.display = "block";

        document.getElementById("archive-game").style.display = "flex";

        document.getElementById("archive-clues-box").innerHTML = "";
        const msgBox = document.getElementById("archive-message-box");
        msgBox.innerHTML = "";
        msgBox.className = "message-box";

        document.getElementById("archive-guess-field").value = "";
        document.getElementById("archive-guess-field").disabled = false;
        document.getElementById("archive-submit-guess").disabled = false;

        document.getElementById("archive-guess-field").focus();

        updateClues();
    } catch (error) {
        console.error("Error starting past game:", error);
        showMessage("Could not load the selected movie.", "error");
    }
}

async function submitGuess() {
    const guessField = document.getElementById("archive-guess-field");
    const userGuess = guessField.value.trim();

    if (!userGuess) {
        showMessage("Please enter a movie name!", "error");
        return;
    }

    try {
        const response = await fetch(`${serverURL}/guess`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ movieId: currentMovieId, guess: userGuess, currentClueIndex })
        });

        if (!response.ok) throw new Error("Failed to check guess");

        const result = await response.json();

        if (result.success) {
            clues = result.allClues;
            currentClueIndex = clues.length;
            updateClues();
            showMessage(`<i class="fa-solid fa-check"></i> <strong>Correct!</strong> The movie was <strong>${userGuess}</strong>`, "success");

            document.getElementById("archive-guess-field").disabled = true;
            document.getElementById("archive-submit-guess").disabled = true;
        } else {
            currentClueIndex = result.currentClueIndex;

            if (result.correctAnswer) {
                showMessage(`<i class="fa-solid fa-xmark"></i> <strong>Game over!</strong> The correct answer was: <strong>${result.correctAnswer}</strong>`, "error");

                document.getElementById("archive-guess-field").disabled = true;
                document.getElementById("archive-submit-guess").disabled = true;
                document.getElementById("archive-guess-field").value = "";
                return;
            }

            if (result.nextClue) {
                clues.push(result.nextClue);
                updateClues();
                document.getElementById('archive-guess-field').value = '';
            }

            if (clues.length === 6) {
                showMessage(`<i class="fa-solid fa-masks-theater"></i> <strong>Last chance!</strong> Final clue: <strong>Actors</strong>.`, "error");
                document.getElementById('archive-guess-field').value = '';
                return;
            }

            updateClues();
            showMessage(`<i class="fa-solid fa-xmark"></i> <strong>Wrong guess!</strong> Here's another clue.`, "error");
        }
    } catch (error) {
        console.error("Error submitting guess:", error);
        showMessage("An error occurred while checking your guess.", "error");
    }

    guessField.value = "";
}

function updateClues() {
    const clueBox = document.getElementById("archive-clues-box");
    clueBox.innerHTML = clues.slice(0, currentClueIndex + 1).join("<br>");
}

function showMessage(message, type) {
    const box = document.getElementById("archive-message-box");
    box.innerHTML = message;
    box.className = `message-box ${type}`;
}

function handleAutocomplete() {
    const query = this.value.trim().toLowerCase();
    const suggestionsBox = document.getElementById("archive-suggestions-box");

    if (query.length < 2) {
        suggestionsBox.innerHTML = "";
        return;
    }

    const matches = filteredMovies
        .filter(movie => movie.name.toLowerCase().startsWith(query))
        .slice(0, 10);

    suggestionsBox.innerHTML = matches.map(movie => `<div class="suggestion">${movie.name}</div>`).join("");

    document.querySelectorAll(".suggestion").forEach(item => {
        item.addEventListener("click", () => {
            document.getElementById("archive-guess-field").value = item.innerText;
            suggestionsBox.innerHTML = "";
        });
    });
}

document.getElementById("archive-guess-field").addEventListener("keydown", function (e) {
    const suggestionsBox = document.getElementById("archive-suggestions-box");
    const firstSuggestion = suggestionsBox.querySelector(".suggestion");

    if (e.key === "Enter") {
        e.preventDefault(); // Prevent form submission

        // If there is a suggestion, pick the first one
        if (firstSuggestion) {
            this.value = firstSuggestion.textContent;
            suggestionsBox.innerHTML = ""; // Clear suggestions
        } else {
            // No suggestion, just submit the guess
            document.getElementById("archive-submit-guess").click();
        }
    }
});