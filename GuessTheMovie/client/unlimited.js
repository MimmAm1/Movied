const serverURL = "http://127.0.0.1:3000";

let currentMovieId = null;
let currentClueIndex = 0;
let clues = [];
let filteredMovies = []; // Store movie names locally
let correctStreak = parseInt(localStorage.getItem("unlimitedStreak")) || 0;
updateStreakDisplay();

// Wait for the page to load
document.addEventListener("DOMContentLoaded", async () => {
    console.log("Unlimited DOM Loaded. Fetching movie list and starting game...");

    // theme
    const savedTheme = localStorage.getItem("theme") || "light";
    document.documentElement.setAttribute("data-theme", savedTheme);

    //

    await fetchMovieList(); // Load movie list once
    startGame();

    // Add event listener to the guess button
    document.getElementById("submit-guess").addEventListener("click", submitGuess);

    document.getElementById("next-movie-button").addEventListener("click", () => {
        // Reset UI and fetch a new movie
        currentClueIndex = 0;
        clues = [];
        document.getElementById("guess-field").value = "";
        document.getElementById("guess-field").disabled = false;
        document.getElementById("submit-guess").disabled = false;
        document.getElementById("next-movie-button").style.display = "none";
        document.getElementById("message-box").innerHTML = "";
        document.getElementById("message-box").className = "message-box";
        document.getElementById("new-game-button").style.display = "none";
        startGame();
    });
    
    document.getElementById("new-game-button").addEventListener("click", () => {
        correctStreak = 0;
        updateStreakDisplay();
        currentClueIndex = 0;
        clues = [];
        document.getElementById("guess-field").value = "";
        document.getElementById("guess-field").disabled = false;
        document.getElementById("submit-guess").disabled = false;
        document.getElementById("message-box").innerHTML = "";
        document.getElementById("message-box").className = "message-box";
        document.getElementById("new-game-button").style.display = "none";
        document.getElementById("next-movie-button").style.display = "none";
        startGame();
    });    

});

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

// Fetch a random movie from the server
async function startGame() {
    try {
        const response = await fetch(`${serverURL}/random-movie`);
        if (!response.ok) throw new Error("Failed to fetch movie");

        const movie = await response.json();
        currentMovieId = movie.id;
        clues = [movie.clues[0]]; // Endast första ledtråden visas i början
        currentClueIndex = 0;
        // Start with the first clue

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
            // Visa alla ledtrådar genom att ersätta den gamla listan
            clues = result.allClues;

            // Uppdatera ledtrådsindex så att allt visas
            currentClueIndex = clues.length;
            updateClues();
            showMessage(`<i class="fa-solid fa-check"></i> <strong>Correct!</strong> The movie was <strong>${userGuess}</strong>`, "success");
            document.getElementById('guess-field').value = result.correctAnswer;
            document.getElementById("guess-field").disabled = true;
            document.getElementById("submit-guess").disabled = true;

            // score update
            correctStreak++;
            updateStreakDisplay();
            localStorage.setItem("unlimitedStreak", correctStreak);
            document.getElementById("next-movie-button").style.display = "inline-block";

        } else {
            currentClueIndex = result.currentClueIndex;

            // If the player has guessed after seeing actors, end the game
            if (result.correctAnswer) {
                console.log("Game Over! The correct movie was:", result.correctAnswer);
                showMessage(`<i class="fa-solid fa-xmark"></i> <strong>Game over!</strong> The correct answer was: <strong>${result.correctAnswer}</strong>`, "error");
                document.getElementById('guess-field').value = result.correctAnswer;
                document.getElementById("guess-field").disabled = true;
                document.getElementById("submit-guess").disabled = true;
                document.getElementById("new-game-button").style.display = "inline-block";

                // reset score
                correctStreak = 0;
                updateStreakDisplay();
                localStorage.setItem("unlimitedStreak", correctStreak);
                document.getElementById("new-game-button").style.display = "inline-block";

                return;
            }

            if (result.nextClue) {
                clues.push(result.nextClue); // Only add the next clue
                document.getElementById('guess-field').value = '';
                updateClues(); // Refresh UI
            }

            // If this is the last clue (Actors), allow one final guess
            if (clues.length == 6) {
                updateClues();
                showMessage(`<i class="fa-solid fa-masks-theater"></i> <strong>This is your last chance!</strong> Final clue: <strong>Actors</strong>.`, "error");
                document.getElementById('guess-field').value = '';
                return;
            }

            updateClues();
            showMessage(`<i class="fa-solid fa-xmark"></i> <strong>Wrong guess!</strong> Here's another clue.`, "error");
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

function updateStreakDisplay() {
    document.getElementById("streak-value").textContent = correctStreak;
}