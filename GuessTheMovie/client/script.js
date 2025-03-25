// Wait for the page to load
document.addEventListener("DOMContentLoaded", async () => {
    console.log("DOM Loaded. Fetching movie list and starting game...");

    // theme
    const savedTheme = localStorage.getItem("theme") || "light";
    document.documentElement.setAttribute("data-theme", savedTheme);

//-----------------------------Experimentellt-----------------------------//

    if (document.querySelector("#scoreboard")) {
        loadScoreboard();
    }
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