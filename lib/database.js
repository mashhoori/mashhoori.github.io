const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Create database connection
const dbPath = path.join(process.cwd(), 'data', 'messages.db');
const db = new sqlite3.Database(dbPath);

// Initialize database and create table if it doesn't exist
function initDatabase() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Create users table
      db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          image TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) {
          reject(err);
          return;
        }
      });

      // Create messages table with user association
      db.run(`
        CREATE TABLE IF NOT EXISTS messages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          text TEXT NOT NULL,
          date TEXT NOT NULL,
          time TEXT NOT NULL,
          user_id TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id)
        )
      `, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  });
}

// Save or update user
function saveUser(user) {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT OR REPLACE INTO users (id, email, name, image) VALUES (?, ?, ?, ?)',
      [user.id, user.email, user.name, user.image],
      function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(user);
        }
      }
    );
  });
}

// Save a message to the database
function saveMessage(text, userId) {
  return new Promise((resolve, reject) => {
    const now = new Date();
    const date = now.toISOString().split('T')[0]; // YYYY-MM-DD format
    const time = now.toTimeString().split(' ')[0]; // HH:MM:SS format
    
    db.run(
      'INSERT INTO messages (text, date, time, user_id) VALUES (?, ?, ?, ?)',
      [text, date, time, userId],
      function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID, text, date, time, user_id: userId });
        }
      }
    );
  });
}

// Get all messages from the database for a specific user
function getAllMessages(userId) {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM messages WHERE user_id = ? ORDER BY created_at DESC', [userId], (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

function deleteMessage(id, userId) {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM messages WHERE id = ? AND user_id = ?', [id, userId], function(err) {
      if (err) {
        reject(err);
      } else {
        resolve({ 
          success: true, 
          message: 'Message deleted',
          deletedId: id 
        });
      }
    });
  });
}

module.exports = {
  initDatabase,
  saveUser,
  saveMessage,
  getAllMessages,
  deleteMessage,
  db
};
