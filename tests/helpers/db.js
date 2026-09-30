const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

// Each test file gets its own throwaway in-memory MongoDB, so tests never touch dev data.
let mongod;

async function connect() {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri('linkstat-test'));
}

// Wipe all collections between tests so they don't depend on each other
async function clear() {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
}

async function close() {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  await mongod.stop();
}

module.exports = { connect, clear, close };
