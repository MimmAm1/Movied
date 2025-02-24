const serverURL = "http://127.0.0.1:3000";

let currentMovieId = null;
let currentClueIndex = 0;
let clues = [];

// Wait for the page to load
document.addEventListener("DOMContentLoaded", () => {
    console.log("DOM Loaded. Starting game...");
    startGame();

    // Add event listener to the guess button
    document.getElementById("submit-guess").addEventListener("click", submitGuess);
});

// Fetch a random movie from the server
async function startGame() {
    try {
        const response = await fetch(`${serverURL}/random-movie`);
        if (!response.ok) throw new Error("Failed to fetch movie");

        const movie = await response.json();
        currentMovieId = movie.id;
        clues = movie.clues;
        currentClueIndex = 0; // Start with the first clue

        // Show the first clue
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
        alert("Please enter a movie name!");
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
            document.querySelector(".guess-container").innerHTML = `<p>✅ Correct! The movie was <strong>${userGuess}</strong></p>`;
        } else {
            currentClueIndex = result.currentClueIndex;
            updateClues();
            alert("❌ Wrong guess! Here's another clue.");
        }
    } catch (error) {
        console.error("Error submitting guess:", error);
        alert("An error occurred while checking your guess.");
    }

    guessField.value = ""; // Clear the input field
}

// Update the UI with the current clues
function updateClues() {
    const clueContainer = document.querySelector(".guess-container");
    clueContainer.innerHTML = `<p>${clues.slice(0, currentClueIndex + 1).join("<br>")}</p>
        <div class="guess-input">
            <input type="text" id="guess-field" placeholder="Enter movie name">
            <button id="submit-guess">Guess</button>
        </div>`;

    // Reattach event listener after updating the DOM
    document.getElementById("submit-guess").addEventListener("click", submitGuess);
}
