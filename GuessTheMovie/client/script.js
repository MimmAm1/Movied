// Wait for the page to load
document.addEventListener("DOMContentLoaded", async () => {
    console.log("DOM Loaded. Fetching movie list and starting game...");

    // theme
    const savedTheme = localStorage.getItem("theme") || "light";
    document.documentElement.setAttribute("data-theme", savedTheme);
});

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