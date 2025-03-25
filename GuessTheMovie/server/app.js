const http = require("node:http");

const { MongoClient } = require("mongodb");

const nlp = require("compromise");

//GLOBAL CONST
const RATING = 6;
const VOTES = 300000;
const YEAR = 1950;

console.log("Incoming request");

const hostname = "127.0.0.1";
const port = 3000;
const serverUrl = `http://${hostname}:${port}`;

const dbHostname = "127.0.0.1";
const dbPort = 27017;
const dbServerUrl = `mongodb://${dbHostname}:${dbPort}`;
const dbClient = new MongoClient(dbServerUrl);

const dbName = "tnm115-project";
const dbCollectionName = "imdb";

const server = http.createServer(async (req, res) => {

    console.log("Incoming request:", req.method, req.url);
    try {

        // Anslut till databasen
        await dbClient.connect();
        const db = dbClient.db(dbName);
        const collection = db.collection(dbCollectionName);

        // Hantera CORS och OPTIONS-förfrågningar
        if (req.method === "OPTIONS") {
            return sendResponse(res, 204);
        }

        // Skapa en URL-objekt
        const requestUrl = new URL(req.url, `http://${hostname}:${port}`);
        console.log("Parsed request path:", requestUrl.pathname);

        const pathComponents = requestUrl.pathname.split("/");
        console.log("Path components:", pathComponents);

        // get a random movie
        if (req.method === "GET" && pathComponents[1] === "random-movie") {
            const movie = await getRandomMovie(collection);
            //console.log(movie);
            if (!movie) return sendError(res, 404, "Ingen film hittades.");
            return sendResponse(res, 200, "application/json", JSON.stringify(movie));
        }

        // get the daily movie of the day
        if (req.method === "GET" && pathComponents[1] === "daily-movie") {
            const movie = await getDailyMovie(collection);
            if (!movie) return sendError(res, 404, "Ingen film hittades.");
            return sendResponse(res, 200, "application/json", JSON.stringify(movie));
        }

        // past daily movies
        if (req.method === "GET" && pathComponents[1] === "past-daily-challenges") {
            const challenges = await getPastDailyChallenges(collection);
            return sendResponse(res, 200, "application/json", JSON.stringify(challenges));
        }

        // get the full movie list of movies that match the criteria
        if (req.method === "GET" && pathComponents[1] === "get-movie-list") {
            const movies = await collection
                .find({
                    rating: { $gte: RATING },
                    year: { $gt: YEAR },
                    votes: { $gte: VOTES }
                })
                .project({ name: 1, _id: 0 }) // Only return movie names
                .toArray();

            console.log(`Loaded ${movies.length} movies for autocomplete.`); // ✅ Log movie count
            return sendResponse(res, 200, "application/json", JSON.stringify(movies));
        }

        if (req.method === "POST" && pathComponents[1] === "guess") {
            let body = "";
            req.on("data", chunk => (body += chunk));
            req.on("end", async () => {
                try {
                    const { movieId, guess, currentClueIndex } = JSON.parse(body);
                    if (!movieId || !guess || currentClueIndex === undefined) {
                        return sendError(res, 400, "movieId, guess, and currentClueIndex is required.");
                    }
                    const result = await checkGuess(collection, movieId, guess, currentClueIndex);
                    return sendResponse(res, 200, "application/json", JSON.stringify(result));
                } catch (error) {
                    return sendError(res, 400, "Felaktigt JSON-format.");
                }
            });
            return;
        }

        if (req.method === "POST" && pathComponents[1] === "get-movie-by-title") {
            let body = "";
            req.on("data", chunk => (body += chunk));
            req.on("end", async () => {
                const { title } = JSON.parse(body);
                if (!title) return sendError(res, 400, "Title is required.");
        
                const movie = await collection.findOne({ title });
                if (!movie) return sendError(res, 404, "Movie not found.");
        
                const keywords = extractKeywords(movie.description);
                const clues = [
                    `Keywords: ${keywords.join(", ")}`,
                    `Genre: ${movie.genre.join(", ")}`,
                    `IMDb Rating: ${movie.rating}`,
                    `Released: ${movie.year}`,
                    `Directed by: ${movie.director.join(", ")}`,
                    `Actors: ${movie.star.join(", ")}`
                ];
        
                return sendResponse(res, 200, "application/json", JSON.stringify({
                    id: movie._id,
                    clues: [clues[0]],
                    currentClueIndex: 0
                }));
            });
        }
    
        // Om ingen route matchar
        return sendError(res, 404, "Sidan hittades inte.");
    } catch (error) {
        console.error("Server error:", error);
        return sendError(res, 500, "Internt serverfel.");
    }
});

server.listen(port, hostname, () => {
    console.log("Server running at " + serverUrl);
});

function sendResponse(res, statusCode, contentType = null, data = null) {
    res.statusCode = statusCode;
    res.setHeader("Access-Control-Allow-Origin", "*"); // Allow requests from any origin
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS"); // Allow these request types
    res.setHeader("Access-Control-Allow-Headers", "Content-Type"); // Allow JSON data

    if (contentType) res.setHeader("Content-Type", contentType);
    res.end(data || "");
}


function sendError(res, statusCode, message) {
    sendResponse(res, statusCode, "application/json", JSON.stringify({ error: message }));
}

async function getRandomMovie(collection) {
    const count = await collection.countDocuments({
        rating: { $gte: RATING },
        year: { $gt: YEAR },
        votes: { $gte: VOTES }
    });

    if (count === 0) return null;

    const randomIndex = Math.floor(Math.random() * count);

    // gör while loop
    const movie = await collection.findOne(
        { rating: { $gte: RATING }, year: { $gt: YEAR }, votes: { $gte: VOTES } },
        { skip: randomIndex }
    );

    if (!movie) return null;

    // Generate clues
    const keywords = extractKeywords(movie.description);
    const clues = [
        `Keywords: ${keywords.join(", ")}`,
        `Genre: ${movie.genre.join(", ")}`,
        `IMDb Rating: ${movie.rating}`,
        `Released: ${movie.year}`,
        `Directed by: ${movie.director.join(", ")}`,
        `Actors: ${movie.star.join(", ")}`
    ];

    return {
        id: movie._id,
        clues: [clues[0]], // Skickar endast första ledtråden
        currentClueIndex: 0
    };
}

async function getDailyMovie(collection) {
    const query = {
        rating: { $gte: RATING },
        year: { $gt: YEAR },
        votes: { $gte: VOTES }
    };

    const count = await collection.countDocuments(query);
    if (count === 0) return null;

    const seed = getTodaySeed(); // deterministic seed
    const rand = mulberry32(seed);
    const dailyIndex = Math.floor(rand() * count);

    const movie = await collection.findOne(query, { skip: dailyIndex });
    if (!movie) return null;

    const keywords = extractKeywords(movie.description);
    const clues = [
        `Keywords: ${keywords.join(", ")}`,
        `Genre: ${movie.genre.join(", ")}`,
        `IMDb Rating: ${movie.rating}`,
        `Released: ${movie.year}`,
        `Directed by: ${movie.director.join(", ")}`,
        `Actors: ${movie.star.join(", ")}`
    ];

    return {
        id: movie._id,
        clues: [clues[0]],
        currentClueIndex: 0
    };
}

function getTodaySeed() {
    const today = new Date().toISOString().split('T')[0]; // "YYYY-MM-DD"
    let hash = 0;
    for (let i = 0; i < today.length; i++) {
        hash = today.charCodeAt(i) + ((hash << 5) - hash);
        hash = hash & hash;
    }
    return Math.abs(hash);
}

function mulberry32(seed) { // från github
    return function () {
        let t = seed += 0x6D2B79F5;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// KEYWORDS GENERATOR!!

function extractKeywords(description) {
    if (!description) return [];

    const doc = nlp(description);

    const stopwords = new Set([
        "a", "an", "and", "are", "as", "at", "be", "but", "by", "for", "from", "has", "he", "her", "his",
        "if", "in", "into", "is", "it", "its", "of", "on", "or", "she", "so", "than", "that", "the", "their",
        "them", "then", "there", "these", "they", "this", "to", "was", "we", "were", "which", "who", "will",
        "with", "you", "your", "about", "after", "again", "all", "also", "am", "any", "because", "been",
        "before", "being", "between", "both", "did", "do", "does", "doing", "down", "during", "each",
        "few", "further", "here", "how", "i", "me", "more", "most", "my", "myself", "no", "nor", "not",
        "now", "off", "once", "only", "other", "our", "ours", "ourselves", "out", "over", "own", "same",
        "should", "some", "such", "through", "too", "under", "until", "up", "very", "what", "when", "where",
        "why", "given"
    ]);

    return description
        .toLowerCase()
        .replace(/[.,!?;()"]/g, '') // Remove punctuation
        .split(/\s+/) // Split into words
        .filter(word => word.length > 3 && !stopwords.has(word)) // Remove stopwords & short words
        .slice(0, 5); // Limit to 5 keywords
}

async function checkGuess(collection, movieId, guess, currentClueIndex) {
    const movie = await collection.findOne({ _id: movieId });
    if (!movie) return { success: false, message: "Filmen hittades inte." };

    const isCorrect = movie.name.toLowerCase() === guess.toLowerCase();
    

    // Get all clues in the right order
    const keywords = extractKeywords(movie.description);
    const clues = [
        `Keywords: ${keywords.join(", ")}`,
        `Genre: ${movie.genre.join(", ")}`,
        `IMDb Rating: ${movie.rating}`,
        `Released: ${movie.year}`,
        `Directed by: ${movie.director.join(", ")}`,
        `Actors: ${movie.star.join(", ")}`
    ];

    if (isCorrect) {
        console.log("rätt svar");
        return { 
            success: true, 
            message: "Rätt svar!", 
            allClues: clues, // alla ledtrådar
            totalClues: clues.length
        };
    }

    // If all clues have been used, send game over message
    if (currentClueIndex >= clues.length - 1) {
        console.log(movie.name);
        return {
            success: false,
            message: "Game over!",
            correctAnswer: movie.name // Send the correct movie name
        };
    }

    // Otherwise, return the next clue
    return {
        success: false,
        message: "Fel gissning.",
        nextClue: clues[currentClueIndex + 1] || null, // Send only the next clue
        currentClueIndex: currentClueIndex + 1
    };

}

// get all of the past daily challenges

async function getPastDailyChallenges(collection) {
    const startDate = new Date("2025-03-22");
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const query = {
        rating: { $gte: RATING },
        year: { $gt: YEAR },
        votes: { $gte: VOTES }
    };

    const allMovies = await collection.find(query).toArray();
    if (allMovies.length === 0) return [];

    const result = [];

    for (let d = new Date(startDate); d <= today; d.setDate(d.getDate() + 1)) {
        const seed = getSeedFromDate(d);
        const rand = mulberry32(seed);
        const index = Math.floor(rand() * allMovies.length);
        const movie = allMovies[index];
        result.push(movie.name); // or movie.name if that's the field
    }

    return result;
}

function getSeedFromDate(date) {
    const dateStr = date.toISOString().split('T')[0];
    let hash = 0;
    for (let i = 0; i < dateStr.length; i++) {
        hash = dateStr.charCodeAt(i) + ((hash << 5) - hash);
        hash = hash & hash;
    }
    return Math.abs(hash);
}
