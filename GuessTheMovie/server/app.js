const http = require("node:http");

const { MongoClient } = require("mongodb");

const nlp = require("compromise");

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

console.log("hello");

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


        if (req.method === "GET") {

            if (pathComponents[1] === "random-movie") {
                const movie = await getRandomMovie(collection);
                if (!movie) return sendError(res, 404, "Ingen film hittades.");
                return sendResponse(res, 200, "application/json", JSON.stringify(movie));
            }
        }

        if (req.method === "POST" && pathComponents[1] === "guess") {
            let body = "";
            req.on("data", chunk => (body += chunk));
            req.on("end", async () => {
                try {
                    const { movieId, guess, currentClueIndex } = JSON.parse(body);
                    if (!movieId || !guess || currentClueIndex === undefined) {
                        return sendError(res, 400, "movieId, guess, and currentClueIndex krävs.");
                    }
                    const result = await checkGuess(collection, movieId, guess, currentClueIndex);
                    return sendResponse(res, 200, "application/json", JSON.stringify(result));
                } catch (error) {
                    return sendError(res, 400, "Felaktigt JSON-format.");
                }
            });
            return;
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
        rating: { $gte: 7.5 },
        year: { $gt: 1960 },
        votes: { $gte: 40000 }
    });

    if (count === 0) return null;

    const randomIndex = Math.floor(Math.random() * count);
    const movie = await collection.findOne(
        { rating: { $gte: 7.5 }, year: { $gt: 1960 }, votes: { $gte: 40000 } },
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
        name: movie.name, // Keep the answer in the backend
        clues,
        currentClueIndex: 0 // Start with the first clue
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
    if (isCorrect) {
        return { success: true, message: "Rätt svar!", clues: [] };
    }

    // Get clues in the correct order
    const keywords = extractKeywords(movie.description);
    const clues = [
        `Keywords: ${keywords.join(", ")}`,
        `Genre: ${movie.genre.join(", ")}`,
        `IMDb Rating: ${movie.rating}`,
        `Released: ${movie.year}`,
        `Directed by: ${movie.director.join(", ")}`,
        `Actors: ${movie.star.join(", ")}`
    ];

    // Reveal the next clue, if available
    const nextClueIndex = Math.min(currentClueIndex + 1, clues.length - 1);
    return {
        success: false,
        message: "Fel gissning.",
        clues: clues.slice(0, nextClueIndex + 1), // Send clues up to the current index
        currentClueIndex: nextClueIndex
    };
}


async function testGetRandomMovie() {
    const { MongoClient } = require("mongodb");

    const dbUri = "mongodb://127.0.0.1:27017"; // Change if your DB is hosted elsewhere
    const dbName = "tnm115-project"; // Change to your actual database name
    const collectionName = "imdb"; // Change to match your collection

    const client = new MongoClient(dbUri);

    try {
        await client.connect();
        console.log("✅ Connected to MongoDB");

        const db = client.db(dbName);
        const collection = db.collection(collectionName);

        // Fetch a random movie
        const movie = await getRandomMovie(collection);

        if (!movie) {
            console.log("❌ No movies found in the database.");
            return;
        }

        // Extract keywords
        const keywords = extractKeywords(movie.description);

        // Log the results
        console.log("Random Movie:", movie.name);
        console.log("Description:", movie.description);
        console.log("Extracted Keywords:", keywords.join(", "));
        console.log("Year:", movie.year);
        console.log(" Genre:", movie.genre.join(", "));
        console.log("IMDb Rating:", movie.rating);
        console.log("Votes:", movie.votes);
        console.log("Director(s):", movie.director.join(", "));
        console.log("Main Actor(s):", movie.star.join(", "));

    } catch (error) {
        console.error("⚠️ Error:", error);
    } finally {
        await client.close();
        console.log("🔌 Disconnected from MongoDB");
    }
}

// Run the test function

//testGetRandomMovie();
