const { MongoClient } = require('mongodb');

const url = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const dbName = 'vietnam_provinces';
let client;
let db;

async function connectDb() {
  if (db) return db;
  client = new MongoClient(url);
  await client.connect();
  db = client.db(dbName);
  return db;
}

async function closeDb() {
  if (client) {
    await client.close();
    db = null;
    client = null;
  }
}

module.exports = { connectDb, closeDb };
