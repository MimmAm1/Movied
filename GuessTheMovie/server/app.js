const http = require("node:http");
const { MongoClient } = require("mongodb");

const hostname = "127.0.0.1";
const port = 3000;
const serverUrl = `http://${hostname}:${port}`;

const dbHostname = "127.0.0.1";
const dbPort = 27017;
const dbServerUrl = `mongodb://${dbHostname}:${dbPort}`;
const dbClient = new MongoClient(dbServerUrl);

const dbName = "tnm115-project";
const dbCollectionName = "imdb";

const RATING = 6;
const VOTES = 300000;
const YEAR = 1950;

let collection;

const server = http.createServer(async (req, res) => {
    try {
        if (req.method === "OPTIONS") return sendResponse(res, 204);

        const requestUrl = new URL(req.url, serverUrl);
        const pathComponents = requestUrl.pathname.replace(/^\/+/g, "").split("/");

        if (req.method === "GET") {
            switch (pathComponents[0]) {
                case "random-movie": {
                    const movie = await getRandomMovie();
                    return movie
                        ? sendResponse(res, 200, "application/json", JSON.stringify(movie))
                        : sendError(res, 404, "No movie found.");
                }
                case "daily-movie": {
                    const movie = await getDailyMovie();
                    return movie
                        ? sendResponse(res, 200, "application/json", JSON.stringify(movie))
                        : sendError(res, 404, "No movie found.");
                }
                case "get-movie-list": {
                    const movies = await collection
                        .find({ rating: { $gte: RATING }, year: { $gt: YEAR }, votes: { $gte: VOTES } })
                        .project({ name: 1, _id: 0 })
                        .toArray();
                    return sendResponse(res, 200, "application/json", JSON.stringify(movies));
                }
                case "past-daily-challenges": {
                    const challenges = await getPastDailyChallenges();
                    return sendResponse(res, 200, "application/json", JSON.stringify(challenges));
                }
            }
        }

        if (req.method === "POST") {
            let body = "";
            req.on("data", chunk => (body += chunk));
            req.on("end", async () => {
                try {
                    const json = JSON.parse(body);

                    if (pathComponents[0] === "guess") {
                        const { movieId, guess, currentClueIndex } = json;
                        if (!movieId || !guess || currentClueIndex === undefined)
                            return sendError(res, 400, "movieId, guess, and currentClueIndex is required.");
                        const result = await checkGuess(movieId, guess, currentClueIndex);
                        return sendResponse(res, 200, "application/json", JSON.stringify(result));
                    }

                    if (pathComponents[0] === "get-movie-by-id") {
                        const { id } = json;
                        if (!id) return sendError(res, 400, "Movie ID is required.");

                        const movie = await collection.findOne({ _id: id });
                        if (!movie) return sendError(res, 404, "Movie not found.");

                        const clues = formatClues(movie, 0, false);
                        return sendResponse(res, 200, "application/json", JSON.stringify({
                            id: movie._id,
                            clues,
                            currentClueIndex: 0
                        }));
                    }

                    return sendError(res, 404, "Unknown POST route.");
                } catch {
                    return sendError(res, 400, "Invalid JSON format.");
                }
            });
            return;
        }

        return sendError(res, 404, "Page not found.");
    } catch (err) {
        console.error("Server error:", err);
        return sendError(res, 500, "Internal server error.");
    }
});

// Starta servern och anslut till databasen
(async () => {
    await dbClient.connect();
    const db = dbClient.db(dbName);
    collection = db.collection(dbCollectionName);
    server.listen(port, hostname, () => {
        console.log("Server running at " + serverUrl);
    });
})();

function sendResponse(res, statusCode, contentType = null, data = null) {
    if (res.headersSent) return;
    res.statusCode = statusCode;
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (contentType) res.setHeader("Content-Type", contentType);
    res.end(data || "");
}

function sendError(res, statusCode, message) {
    sendResponse(res, statusCode, "application/json", JSON.stringify({ error: message }));
}

function formatClues(movie, currentClueIndex = 0, oneClueOnly = true) {
    const keywords = extractKeywords(movie.description);
    const clues = [
        `<span class="clue-title">Keywords:</span> ${keywords.join(", ")}`,
        `<span class="clue-title">Genre:</span> ${movie.genre.join(", ")}`,
        `<span class="clue-title">IMDb Rating:</span> ${movie.rating}`,
        `<span class="clue-title">Released:</span> ${movie.year}`,
        `<span class="clue-title">Directed by:</span> ${movie.director.join(", ")}`,
        `<span class="clue-title">Actors:</span> ${movie.star.join(", ")}`
    ];
    return oneClueOnly ? [clues[currentClueIndex]] : clues;
}

async function getRandomMovie() {
    const count = await collection.countDocuments({ rating: { $gte: RATING }, year: { $gt: YEAR }, votes: { $gte: VOTES } });
    if (count === 0) return null;
    const randomIndex = Math.floor(Math.random() * count);
    const movie = await collection.findOne({ rating: { $gte: RATING }, year: { $gt: YEAR }, votes: { $gte: VOTES } }, { skip: randomIndex });
    if (!movie) return null;
    return {
        id: movie._id,
        clues: formatClues(movie),
        currentClueIndex: 0
    };
}

async function getDailyMovie() {
    const query = { rating: { $gte: RATING }, year: { $gt: YEAR }, votes: { $gte: VOTES } };
    const count = await collection.countDocuments(query);
    if (count === 0) return null;

    const seed = getTodaySeed();
    const rand = mulberry32(seed);
    const dailyIndex = Math.floor(rand() * count);

    const movie = await collection.findOne(query, { skip: dailyIndex });
    if (!movie) return null;

    return {
        id: movie._id,
        clues: formatClues(movie),
        currentClueIndex: 0
    };
}

async function checkGuess(movieId, guess, currentClueIndex) {
    const movie = await collection.findOne({ _id: movieId });
    if (!movie) return { success: false, message: "Movie not found." };

    const isCorrect = movie.name.toLowerCase() === guess.toLowerCase();
    const clues = formatClues(movie, 0, false);

    if (isCorrect) {
        return { success: true, message: "Correct!", allClues: clues, totalClues: clues.length };
    }

    if (currentClueIndex >= clues.length - 1) {
        return { success: false, message: "Game over!", correctAnswer: movie.name };
    }

    return {
        success: false,
        message: "Wrong guess.",
        nextClue: clues[currentClueIndex + 1],
        currentClueIndex: currentClueIndex + 1
    };
}

async function getPastDailyChallenges() {
    const startDate = new Date("2025-03-22");
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const allMovies = await collection.find({ rating: { $gte: RATING }, year: { $gt: YEAR }, votes: { $gte: VOTES } }).toArray();
    if (allMovies.length === 0) return [];

    const result = [];
    for (let d = new Date(startDate); d <= today; d.setDate(d.getDate() + 1)) {
        const seed = getSeedFromDate(d);
        const rand = mulberry32(seed);
        const index = Math.floor(rand() * allMovies.length);
        result.push({ id: allMovies[index]._id });
    }
    return result;
}

function extractKeywords(description) {
    if (!description) return [];
    const stopwords = new Set(["a", "an", "and", "are", "as", "at", "be", "but", "by", "for", "from", "has", "he", "her", "his", "if", "in", "into", "is", "it", "its", "of", "on", "or", "she", "so", "than", "that", "the", "their", "them", "then", "there", "these", "they", "this", "to", "was", "we", "were", "which", "who", "will", "with", "you", "your", "about", "after", "again", "all", "also", "am", "any", "because", "been", "before", "being", "between", "both", "did", "do", "does", "doing", "down", "during", "each", "few", "further", "here", "how", "i", "me", "more", "most", "my", "myself", "no", "nor", "not", "now", "off", "once", "only", "other", "our", "ours", "ourselves", "out", "over", "own", "same", "should", "some", "such", "through", "too", "under", "until", "up", "very", "what", "when", "where", "why", "given"]);
    return description.toLowerCase().replace(/[.,!?;()\"]+/g, '').split(/\s+/).filter(word => word.length > 3 && !stopwords.has(word)).slice(0, 5);
}

function getTodaySeed() {
    return getSeedFromDate(new Date());
}

function getSeedFromDate(date) {
    const dateStr = date.toISOString().split('T')[0];
    let hash = 0;
    for (let i = 0; i < dateStr.length; i++) {
        hash = dateStr.charCodeAt(i) + ((hash << 5) - hash);
        hash &= hash;
    }
    return Math.abs(hash);
}

function mulberry32(seed) {
    return function () {
        let t = seed += 0x6D2B79F5;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}