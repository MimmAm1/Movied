const serverURL = "http://127.0.0.1:3000";

let currentMovieId = null;
let currentClueIndex = 0;
let clues = [];
let filteredMovies = []; // Store movie names locally

document.addEventListener("DOMContentLoaded", async () => {
    console.log("Daily DOM Loaded. Fetching movie list and starting game...");

    // theme
    const savedTheme = localStorage.getItem("theme") || "light";
    document.documentElement.setAttribute("data-theme", savedTheme);

    //

    await fetchMovieList(); // Load movie list once
    startGame();

    //-----------------------------Experimentellt-----------------------------//

    if (document.querySelector("#scoreboard")) {
        loadScoreboard();
    }

    //___________________________________________________________________________//


    // Add event listener to the guess button
    document.getElementById("daily-submit-guess").addEventListener("click", submitGuess);
});

function getDailyKey() {
    return new Date().toISOString().split('T')[0]; // e.g. "2025-03-25"
}

// Fetch movie list for autocomplete
async function fetchMovieList() {
    try {
        const response = await fetch(`${serverURL}/get-movie-list`);
        filteredMovies = await response.json();
        console.log(`Movie list loaded: ${filteredMovies.length} movies.`);
    } catch (error) {
        console.error("Error fetching movie list:", error);
    }
}

async function startGame() {
    const dailyKey = getDailyKey();
    const savedState = JSON.parse(localStorage.getItem("dailyGameState"));

    if (savedState && savedState.date === dailyKey) {
        console.log("Restoring saved game state...");
        currentMovieId = savedState.movieId;
        clues = savedState.clues;
        clues = clues.map(clue => {
            const temp = document.createElement("div");
            temp.innerHTML = clue;
            return temp.innerHTML;
        });
        currentClueIndex = savedState.currentClueIndex;
        updateClues();

        if (savedState.finished) {
            currentClueIndex = clues.length - 1;
            document.getElementById("daily-guess-field").disabled = true;
            document.getElementById("daily-submit-guess").disabled = true;
            showMessage(savedState.message, savedState.messageType);

            startMidnightCountdown();
        }

        updateClues()
        document.getElementById("daily-guess-field").focus();
        return;
    }

    try {
        const response = await fetch(`${serverURL}/daily-movie`);
        if (!response.ok) throw new Error("Failed to fetch movie");

        const movie = await response.json();
        currentMovieId = movie.id;
        clues = [movie.clues[0]];
        currentClueIndex = 0;
        updateClues();
        document.getElementById("daily-guess-field").focus();

        // Save initial state
        saveGameState();
    } catch (error) {
        console.error("Error starting game:", error);
        document.querySelector(".guess-container").innerHTML = "<p>Failed to load movie.</p>";
    }
}

// Handle user guesses
async function submitGuess() {
    const guessField = document.getElementById("daily-guess-field");
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
            currentClueIndex = clues.length; // Show all clues
            updateClues();
            showMessage(`<i class="fa-solid fa-check"></i> <strong>Correct!</strong> The movie was <strong>${userGuess}</strong>`, "success");
            startMidnightCountdown();

            document.getElementById('daily-guess-field').value = userGuess;
            document.getElementById("daily-guess-field").disabled = true;
            document.getElementById("daily-submit-guess").disabled = true;

            saveGameState(`<i class="fa-solid fa-check"></i> <strong>Correct!</strong> The movie was <strong>${userGuess}</strong>`, "success", true);
        } else {
            currentClueIndex = result.currentClueIndex;

            // If the player has guessed after seeing actors, end the game
            if (result.correctAnswer) {
                console.log("Game Over! The correct movie was:", result.correctAnswer);
                showMessage(`<i class="fa-solid fa-xmark"></i> <strong>Game over!</strong> The correct answer was: <strong>${result.correctAnswer}</strong>`, "error");
                startMidnightCountdown();

                document.getElementById("daily-guess-field").disabled = true;
                document.getElementById("daily-submit-guess").disabled = true;

                saveGameState(`<i class="fa-solid fa-xmark"></i> <strong>Game over!</strong> The correct answer was: <strong>${result.correctAnswer}</strong>`, "error", true);
                return;
            }

            if (result.nextClue) {
                clues.push(result.nextClue); // Only add the next clue
                document.getElementById('daily-guess-field').value = '';
                updateClues(); // Refresh UI
                guessField.value = ""; // Clear input field
            }

            // If this is the last clue (Actors), allow one final guess
            if (clues.length == 6) {
                updateClues();
                showMessage(`<i class="fa-solid fa-masks-theater"></i> <strong>This is your last chance!</strong> Final clue: <strong>Actors</strong>.`, "error");
                saveGameState();
                document.getElementById('daily-guess-field').value = '';
                return;
            }

            updateClues();
            showMessage(`<i class="fa-solid fa-xmark"></i> <strong>Wrong guess!</strong> Here's another clue.`, "error");
            saveGameState();
        }
    } catch (error) {
        console.error("Error submitting guess:", error);
        showMessage("An error occurred while checking your guess.", "error");
    }
}

function saveGameState(message = "", messageType = "", finished = false) {
    const gameState = {
        date: getDailyKey(),
        movieId: currentMovieId,
        clues,
        currentClueIndex,
        message,
        messageType,
        finished
    };
    localStorage.setItem("dailyGameState", JSON.stringify(gameState));
}

// Show messages under the input field
function showMessage(message, type) {
    const messageBox = document.getElementById("message-box-d");
    messageBox.innerHTML = message;
    messageBox.className = type;
}

// Update the UI with the current clues
function updateClues() {
    const clueBox = document.getElementById("clues-box-d");
    clueBox.innerHTML = clues.slice(0, currentClueIndex + 1).join("<br>"); // Show all revealed clues
}

function startMidnightCountdown() {
    const countdownEl = document.getElementById("countdown");
    countdownEl.style.display = "block";

    function updateCountdown() {
        const now = new Date();
        const midnight = new Date();
        midnight.setHours(24, 0, 0, 0); // Next midnight

        const diff = midnight - now;

        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        countdownEl.innerHTML = `<span class="countdown-text">Refreshes in:</span> <span class="countdown-number">${hours}</span>h <span class="countdown-number">${minutes}</span>m <span class="countdown-number">${seconds}</span>s`;
    }

    updateCountdown(); // Initial call
    setInterval(updateCountdown, 1000); // Update every second
}

// Handle input for autocomplete
document.getElementById("daily-guess-field").addEventListener("input", function () {
    const query = this.value.trim().toLowerCase();
    const suggestionsBox = document.getElementById("suggestions-box-d");

    if (query.length < 2) {
        suggestionsBox.innerHTML = ""; // Clear suggestions if query is too short
        return;
    }

    // Filter movie names locally
    const matchingMovies = filteredMovies
        .filter(movie => movie.name.toLowerCase().startsWith(query))
        .slice(0, 10); // Limit to 10 results

    if (matchingMovies.length === 0) {
        suggestionsBox.innerHTML = ""; // Clear dropdown if no match
        return;
    }

    // Populate the suggestions dropdown
    suggestionsBox.innerHTML = matchingMovies
        .map(movie => `<div class="suggestion">${movie.name}</div>`)
        .join("");

    // Click event: Select a movie from the dropdown
    document.querySelectorAll(".suggestion").forEach(item => {
        item.addEventListener("click", function () {
            document.getElementById("daily-guess-field").value = this.innerText;
            suggestionsBox.innerHTML = ""; // Hide suggestions after selection
        });
    });
});

document.getElementById("daily-guess-field").addEventListener("keydown", function (e) {
    const suggestionsBox = document.getElementById("suggestions-box-d");
    const firstSuggestion = suggestionsBox.querySelector(".suggestion");

    if (e.key === "Enter") {
        e.preventDefault(); // Prevent form submission

        // If there is a suggestion, pick the first one
        if (firstSuggestion) {
            this.value = firstSuggestion.textContent;
            suggestionsBox.innerHTML = ""; // Clear suggestions
        } else {
            // No suggestion, just submit the guess
            document.getElementById("daily-submit-guess").click();
        }
    }
});