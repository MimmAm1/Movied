const http = require("node:http");

const { MongoClient } = require("mongodb");

const nlp = require("compromise");

const hostname = "127.0.0.1";
const port = 3000;
const serverUrl = `http://${hostname}:${port}`;

const dbHostname = "127.0.0.1";
const dbPort = 27017;
const dbServerUrl = `mongodb://${dbHostname}:${dbPort}`;
const dbClient = new MongoClient(dbServerUrl);

const dbName = "movied";
const dbCollectionName = "imdb_data";

const server = http.createServer(async (req, res) => {
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
        const requestUrl = new URL(serverUrl + req.url);
        const pathComponents = requestUrl.pathname.split("/");

        // Hantera inkommande requests


        //

        if (req.method === "GET") {
            if (pathComponents[1] === "random-movie") {
                const movie = await getRandomMovie(collection);
                if (!movie) return sendError(res, 404, "Ingen film hittades.");
                return sendResponse(res, 200, "application/json", JSON.stringify(movie));
            }
        }

        if (req.method === "POST") {
            if (pathComponents[1] === "guess") {
                let body = "";
                req.on("data", chunk => (body += chunk));
                req.on("end", async () => {
                    try {
                        const { movieId, guess } = JSON.parse(body);
                        if (!movieId || !guess) {
                            return sendError(res, 400, "Både movieId och guess krävs.");
                        }
                        const result = await checkGuess(collection, movieId, guess);
                        return sendResponse(res, 200, "application/json", JSON.stringify(result));
                    } catch (error) {
                        return sendError(res, 400, "Felaktigt JSON-format.");
                    }
                });
                return;
            }
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
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "*");
    if (contentType) res.setHeader("Content-Type", contentType);
    res.end(data || "");
}

function sendError(res, statusCode, message) {
    sendResponse(res, statusCode, "application/json", JSON.stringify({ error: message }));
}

async function getRandomMovie(collection) {
    const count = await collection.countDocuments();
    if (count === 0) return null;

    const randomIndex = Math.floor(Math.random() * count);
    const movie = await collection.findOne({}, { skip: randomIndex });

    return movie
        ? {
              id: movie._id, // IMDb ID
              name: movie.name, // Movie title
              year: movie.year,
              runtime: movie.runtime,
              genre: movie.genre,
              rating: movie.rating,
              description: movie.description,
              director: movie.director, // Array of directors
              star: movie.star // Array of main actors
          }
        : null;
}

function extractKeywords(description) {
    if (!description) return [];

    // Common words to ignore
    const stopwords = new Set([
        "the", "and", "of", "in", "to", "his", "her", "a", "on", "for", "is", "it", "from", "by", "with", "at", "an"
    ]);

    // Split into words, remove punctuation, and filter stopwords
    return description
        .toLowerCase()
        .replace(/[.,]/g, '') // Remove punctuation
        .split(" ") // Split into words
        .filter(word => word.length > 3 && !stopwords.has(word)) // Keep only meaningful words
        .slice(0, 5); // Limit to the first 5 words
}

async function checkGuess(collection, movieId, guess) {
    const movie = await collection.findOne({ _id: movieId });
    if (!movie) return { success: false, message: "Filmen hittades inte." };

    const isCorrect = movie.title.toLowerCase() === guess.toLowerCase();
    return { success: isCorrect, message: isCorrect ? "Rätt svar!" : "Fel gissning." };
}
