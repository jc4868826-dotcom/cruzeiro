'use strict';

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { DATA_DIR } = require('../config');
const logger = require('../utils/logger');

// Simple in-memory lock map to prevent concurrent writes to the same file
const locks = new Map();

function filePath(collection) {
  return path.join(DATA_DIR, `${collection}.json`);
}

/**
 * Acquire a simple async lock for a collection.
 * Returns a release function.
 */
async function acquireLock(collection) {
  while (locks.get(collection)) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  locks.set(collection, true);
  return function release() {
    locks.delete(collection);
  };
}

/**
 * Read all records from a collection JSON file.
 * Creates the file with an empty array if it doesn't exist.
 */
function readFile(collection) {
  const fp = filePath(collection);
  if (!fs.existsSync(fp)) {
    fs.writeFileSync(fp, JSON.stringify([], null, 2), 'utf8');
    return [];
  }
  try {
    const raw = fs.readFileSync(fp, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    logger.warn(`db.readFile: could not parse ${fp}, resetting to []`, err.message);
    fs.writeFileSync(fp, JSON.stringify([], null, 2), 'utf8');
    return [];
  }
}

/**
 * Write array of records to a collection JSON file.
 */
function writeFile(collection, data) {
  const fp = filePath(collection);
  fs.writeFileSync(fp, JSON.stringify(data, null, 2), 'utf8');
}

/**
 * Get all records in a collection.
 */
async function getAll(collection) {
  const release = await acquireLock(collection);
  try {
    return readFile(collection);
  } finally {
    release();
  }
}

/**
 * Get a single record by id.
 */
async function getById(collection, id) {
  const release = await acquireLock(collection);
  try {
    const data = readFile(collection);
    return data.find((item) => item.id === id) || null;
  } finally {
    release();
  }
}

/**
 * Insert a new record. Generates id and createdAt if not present.
 */
async function save(collection, record) {
  const release = await acquireLock(collection);
  try {
    const data = readFile(collection);
    const newRecord = {
      ...record,
      id: record.id || uuidv4(),
      createdAt: record.createdAt || new Date().toISOString(),
    };
    data.push(newRecord);
    writeFile(collection, data);
    return newRecord;
  } finally {
    release();
  }
}

/**
 * Update a record by id with a partial patch. Adds updatedAt.
 */
async function update(collection, id, patch) {
  const release = await acquireLock(collection);
  try {
    const data = readFile(collection);
    const idx = data.findIndex((item) => item.id === id);
    if (idx === -1) return null;
    data[idx] = {
      ...data[idx],
      ...patch,
      id, // prevent id override
      updatedAt: new Date().toISOString(),
    };
    writeFile(collection, data);
    return data[idx];
  } finally {
    release();
  }
}

/**
 * Remove a record by id.
 */
async function remove(collection, id) {
  const release = await acquireLock(collection);
  try {
    const data = readFile(collection);
    const idx = data.findIndex((item) => item.id === id);
    if (idx === -1) return false;
    data.splice(idx, 1);
    writeFile(collection, data);
    return true;
  } finally {
    release();
  }
}

module.exports = { getAll, getById, save, update, remove };
