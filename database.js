const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'project.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Database connection error:', err.message);
    } else {
        console.log('Connected to the local SQLite database at:', dbPath);
        initializeDatabase();
    }
});

function initializeDatabase() {
    db.run(`
        CREATE TABLE IF NOT EXISTS registrations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE,
            access_key TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `, (err) => {
        if (err) {
            console.error('Error creating registrations table:', err.message);
        } else {
            console.log('Registrations table initialized.');
        }
    });
}

function saveRegistration(email, accessKey) {
    return new Promise((resolve, reject) => {
        const query = `INSERT INTO registrations (email, access_key) VALUES (?, ?)`;
        db.run(query, [email, accessKey], function(err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    // Update key for existing email instead of failing
                    const updateQuery = `UPDATE registrations SET access_key = ? WHERE email = ?`;
                    db.run(updateQuery, [accessKey, email], function(updateErr) {
                        if (updateErr) reject(updateErr);
                        else resolve({ email, accessKey, updated: true });
                    });
                } else {
                    reject(err);
                }
            } else {
                resolve({ email, accessKey, id: this.lastID, updated: false });
            }
        });
    });
}

function getAllRegistrations() {
    return new Promise((resolve, reject) => {
        db.all(`SELECT * FROM registrations ORDER BY created_at DESC`, [], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

module.exports = {
    saveRegistration,
    getAllRegistrations,
    db
};
