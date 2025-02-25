const serverURL = "http://127.0.0.1:3000";

let currentMovieId = null;
let currentClueIndex = 0;
let clues = [];
let filteredMovies = []; // Store movie names locally

// Wait for the page to load
document.addEventListener("DOMContentLoaded", async () => {
    console.log("DOM Loaded. Fetching movie list and starting game...");
    await fetchMovieList(); // Load movie list once
    startGame();

    // Add event listener to the guess button
    document.getElementById("submit-guess").addEventListener("click", submitGuess);
});

// Fetch movie list for autocomplete
async function fetchMovieList() {
    try {
        const response = await fetch(`${serverURL}/get-movie-list`);
        filteredMovies = await response.json();
        console.log(`✅ Movie list loaded: ${filteredMovies.length} movies.`);
    } catch (error) {
        console.error("⚠️ Error fetching movie list:", error);
    }
}

// Fetch a random movie from the server
async function startGame() {
    try {
        const response = await fetch(`${serverURL}/random-movie`);
        if (!response.ok) throw new Error("Failed to fetch movie");

        const movie = await response.json();
        currentMovieId = movie.id;
        clues = movie.clues;
        currentClueIndex = 0; // Start with the first clue

        updateClues();
    } catch (error) {
        console.error("Error starting game:", error);
        document.querySelector(".guess-container").innerHTML = "<p>Failed to load movie.</p>";
    }
}

// Handle user guesses
async function submitGuess() {
    const guessField = document.getElementById("guess-field");
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
            currentClueIndex = clues.length; // Show all clues
            updateClues();
            showMessage(`✅ Correct! The movie was <strong>${userGuess}</strong>`, "success");
            document.getElementById("guess-field").disabled = true;
            document.getElementById("submit-guess").disabled = true;
        } else {
            currentClueIndex = result.currentClueIndex;

            // If this is the last clue (Actors), allow one final guess
            if (currentClueIndex === clues.length - 1) {
                updateClues();
                showMessage("🎭 This is your last chance! Final clue: Actors.", "error");
                return;
            }

            // If the player has guessed after seeing actors, end the game
            if (result.correctAnswer) {
                console.log("Game Over! The correct movie was:", result.correctAnswer);
                showMessage(`❌ Game over! The correct answer was: <strong>${result.correctAnswer}</strong>`, "error");
                document.getElementById("guess-field").disabled = true;
                document.getElementById("submit-guess").disabled = true;
                return;
            }

            updateClues();
            showMessage("❌ Wrong guess! Here's another clue.", "error");
        }
    } catch (error) {
        console.error("Error submitting guess:", error);
        showMessage("An error occurred while checking your guess.", "error");
    }

    guessField.value = ""; // Clear input field
}

// Show messages under the input field
function showMessage(message, type) {
    const messageBox = document.getElementById("message-box");
    messageBox.innerHTML = message;
    messageBox.className = type;
}

// Update the UI with the current clues
function updateClues() {
    const clueBox = document.getElementById("clues-box");
    clueBox.innerHTML = clues.slice(0, currentClueIndex + 1).join("<br>"); // Show all revealed clues
}

// Handle input for autocomplete
document.getElementById("guess-field").addEventListener("input", function () {
    const query = this.value.trim().toLowerCase();
    const suggestionsBox = document.getElementById("suggestions-box");

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
            document.getElementById("guess-field").value = this.innerText;
            suggestionsBox.innerHTML = ""; // Hide suggestions after selection
        });
    });
});
