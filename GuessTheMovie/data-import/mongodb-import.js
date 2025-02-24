/*
 *  Filename: project-material/data-import/mongodb-import.js
 *  Description: This file accompanies the provided course project material and 
 *               is used to import all the JSON data stuctures inside the ./data directory
 *               into the MongoDB data storage system.
 *  Course Code: TNM115-2025VT
 *  Institution: Linköping University
 *
 *  Author: Nico Reski
 *  Version: 2025-02-14
 */

// === IMPORTANT: Database Setup =============================================================
// To run the script, use the CLI to navigate into the same directory as this file,
// and make sure all the external modules ('mongodb') are installed according to the
// dependencies as declared in the package.json file by running the following command:
// npm install
//
// Then, run the following command to perform the data import:
// node mongodb-import.js
//
// Observe the console.log() output and ensure that there were no errors.
// Observe that this process may take a few seconds/minutes to complete. Please be patient
// and wait for it to finish.
//
// Explore the inserted documents in the database/document collection via
// "MongoDB for VS Code" extension directly in Visual Studio Code.
// ===========================================================================================

// declaration of additional modules
const fs = require("node:fs");  // Node.js default 'filesystem'; just here for potential error log writing

// declaration of JSON data for data import into MongoDB
const actorInfoJsonData = require("./data/actorinfo.json");       
console.log("ActorInfo Data Loaded for DB Import (version): " + actorInfoJsonData.version);
const bechdelJsonData = require("./data/bechdel.json");       
console.log("Bechdel Data Loaded for DB Import (version): " + bechdelJsonData.version);
const imdbJsonData = require("./data/imdb.json");
console.log("IMDb Data Loaded for DB Import (version): " + imdbJsonData.version);

// MongoDB Driver Module loading, server configuration, and database client initialization
const MongoClient = require("mongodb").MongoClient;
const dbHostname = "127.0.0.1"; 
const dbPort = 27017;
const dbServerUrl = "mongodb://" + dbHostname + ":" + dbPort + "";
const dbClient = new MongoClient(dbServerUrl);

// names of the Database and (Document) Collections on the MongoDB Server
const dbName = "tnm115-project";
const dbCollectionName_ActorInfo = "actorinfo";
const dbCollectionName_bechdel = "bechdel";
const dbCollectionName_imdb = "imdb";

// helper function (for use use as callback), closing an established (active) connection to the MongoDB server
function closeDbConnection(){
    dbClient.close();
    console.log("=== FINISHED IMPORTING DATA ===");
}

// function for inserting the Actor Info data into the MongoDB database
async function performActorInfoDataImport(){
    console.log("=== START IMPORTING Actor Info DATA ===");
    
    await dbClient.connect();                                         // (1) establish an active connection to the specified MongoDB server
    const db = dbClient.db(dbName);                                   // (2) select (create) a specified database on the server
    const dbCollection = db.collection(dbCollectionName_ActorInfo);   // (3) select (create) a specified (document) collection in the database
    
    await dbCollection.insertMany(actorInfoJsonData.data);
    console.log("Document Count in " +  dbCollectionName_ActorInfo + " Collection:", await dbCollection.countDocuments());
}

// function for inserting the Bechdel Test data into the MongoDB database
async function performBechdelDataImport(){
    console.log("=== START IMPORTING Bechdel Test DATA ===");
    
    await dbClient.connect();                                       // (1) establish an active connection to the specified MongoDB server
    const db = dbClient.db(dbName);                                 // (2) select (create) a specified database on the server
    const dbCollection = db.collection(dbCollectionName_bechdel);   // (3) select (create) a specified (document) collection in the database
    
    await dbCollection.insertMany(bechdelJsonData.data);
    console.log("Document Count in " +  dbCollectionName_bechdel + " Collection:", await dbCollection.countDocuments());
}

// function for inserting the IMDb data into the MongoDB database
async function performImdbDataImport(){
    console.log("=== START IMPORTING IMDb DATA ===");
    
    await dbClient.connect();                                    // (1) establish an active connection to the specified MongoDB server
    const db = dbClient.db(dbName);                              // (2) select (create) a specified database on the server
    const dbCollection = db.collection(dbCollectionName_imdb);   // (3) select (create) a specified (document) collection in the database
    
    await dbCollection.insertMany(imdbJsonData.data);
    console.log("Document Count in " +  dbCollectionName_imdb + " Collection:", await dbCollection.countDocuments());
}

// PERFORM THE DATA IMPORT
// (sequentially, i.e., import the second dataset only after the first one has finished, and so on)
performActorInfoDataImport()
.catch((error) => {
    fs.writeFile("./artistinfo-import-error.txt", error.toString(), (err) => {
        if(err) console.log("Could not write error log to file for Actor Info data.");
        else console.log("Error log written to file for Actor Info data.");
    });
})
.finally(() => {
    performBechdelDataImport()
    .catch((error) => {
        fs.writeFile("./bechdel-import-error.txt", error.toString(), (err) => {
            if(err) console.log("Could not write error log to file for Bechdel data.");
            else console.log("Error log written to file for Bechdel data.");
        });
    })
    .finally(() => {
        performImdbDataImport()
        .catch((error) => {
            fs.writeFile("./imdb-import-error.txt", error.toString(), (err) => {
                if(err) console.log("Could not write error log to file for IMDb data.");
                else console.log("Error log written to file for IMDb data.");
            });
        })
        .finally(() => {
            closeDbConnection();
        });
    });
});
