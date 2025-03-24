const serverURL = "http://127.0.0.1:3000";

let currentMovieId = null;
let currentClueIndex = 0;
let clues = [];
let filteredMovies = []; // Store movie names locally

// Wait for the page to load
document.addEventListener("DOMContentLoaded", async () => {
    console.log("DOM Loaded. Fetching movie list and starting game...");

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
    document.getElementById("submit-guess").addEventListener("click", submitGuess);
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
            currentClueIndex = clues.length; // Show all clues
            updateClues();
            showMessage(`✅ Correct! The movie was <strong>${userGuess}</strong>`, "success");
            document.getElementById("guess-field").disabled = true;
            document.getElementById("submit-guess").disabled = true;
        } else {
            currentClueIndex = result.currentClueIndex;

                    

            // If the player has guessed after seeing actors, end the game
            if (result.correctAnswer) {
                console.log("Game Over! The correct movie was:", result.correctAnswer);
                showMessage(`❌ Game over! The correct answer was: <strong>${result.correctAnswer}</strong>`, "error");
                document.getElementById("guess-field").disabled = true;
                document.getElementById("submit-guess").disabled = true;
                return;
            }

            if (result.nextClue) {
                clues.push(result.nextClue); // Only add the next clue
                updateClues(); // Refresh UI
            }    

            // If this is the last clue (Actors), allow one final guess
            if (clues.length == 6) {
                updateClues();
                showMessage("🎭 This is your last chance! Final clue: Actors.", "error");
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



//--------------------------------Exprimentellt-----------------------------------//
async function loadScoreboard() {
    try {
        const response = await fetch(`${serverURL}/scoreboard`);
        if (!response.ok) throw new Error("Failed to load scoreboard");

        const scores = await response.json();
        updateScoreboard(scores);
    } catch (error) {
        console.error("⚠️ Error loading scoreboard:", error);
    }
}

function updateScoreboard(scores) {
    const tbody = document.querySelector("#scoreboard tbody");
    tbody.innerHTML = "";

    scores.forEach((player, index) => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${player.name}</td>
            <td>${player.score}</td>
        `;
        tbody.appendChild(row);
    });
}

//__________________________________________________________________________________//

function navOpen() {
    const navMenu = document.querySelector(".nav-item-container");
    const navIcon = document.getElementById("nav-icon3");
    const nav = document.querySelector(".nav");

    const open = !navIcon.classList.contains("open");

    navIcon.classList.toggle("open", open);
    navMenu.classList.toggle("active", open);

    if (open) {
        nav.style.backgroundColor = "color-mix(in srgb, var(--accent) 0%, transparent)";
        navMenu.style.backgroundColor = "color-mix(in srgb, var(--accent) 50%, transparent)";
        document.addEventListener("click", handleOutsideClick);
    } else {
        nav.style.backgroundColor = "color-mix(in srgb, var(--accent) 0%, transparent)";
        navMenu.style.backgroundColor = "color-mix(in srgb, var(--accent) 10%, transparent)";
        document.removeEventListener("click", handleOutsideClick);
    }
}

function handleOutsideClick(e) {
    const navMenu = document.querySelector(".nav-item-container");
    const navIcon = document.getElementById("nav-icon3");

    if (!navMenu.contains(e.target) && !navIcon.contains(e.target)) {
        navIcon.classList.remove("open");
        navMenu.classList.remove("active");
        navMenu.style.backgroundColor = "color-mix(in srgb, var(--accent) 10%, transparent)";
        document.removeEventListener("click", handleOutsideClick);
    }
}

// theme

function toggleTheme() {
    const current = document.documentElement.getAttribute("data-theme");
    const newTheme = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", newTheme);
    localStorage.setItem("theme", newTheme);
}
