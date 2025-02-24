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
        console.log("🎬 Random Movie:", movie.name);
        console.log("📜 Description:", movie.description);
        console.log("🔑 Extracted Keywords:", keywords);
    } catch (error) {
        console.error("⚠️ Error:", error);
    } finally {
        await client.close();
        console.log("🔌 Disconnected from MongoDB");
    }
}

// Run the test function
testGetRandomMovie();
