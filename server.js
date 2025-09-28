const express = require('express');
const next = require('next');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();
const port = process.env.PORT || 3000;

const dataDir = path.join(__dirname, 'data');
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const db = new sqlite3.Database(path.join(dataDir, 'site.db'));

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    tags TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );`);

  db.run(`CREATE TABLE IF NOT EXISTS links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    description TEXT,
    category TEXT,
    tags TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );`);

  db.run(`CREATE TABLE IF NOT EXISTS images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_name TEXT NOT NULL,
    original_name TEXT,
    caption TEXT,
    tags TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );`);
});

const run = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) {
        reject(err);
      } else {
        resolve({ lastID: this.lastID, changes: this.changes });
      }
    });
  });

const all = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });

const get = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, uploadDir);
    },
    filename: (_req, file, cb) => {
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
      const sanitized = file.originalname.replace(/[^a-zA-Z0-9.\-]/g, '_');
      cb(null, `${uniqueSuffix}-${sanitized}`);
    }
  }),
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      cb(new Error('Only image uploads are allowed'));
    } else {
      cb(null, true);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024
  }
});

function mapRow(row) {
  if (!row) return row;
  return {
    ...row,
    tags: row.tags ? row.tags.split(',').map((tag) => tag.trim()).filter(Boolean) : []
  };
}

function buildFilters(query, columns) {
  const conditions = [];
  const params = [];
  if (query.search && Array.isArray(columns) && columns.length) {
    const likeClauses = columns.map((column) => `${column} LIKE ?`);
    conditions.push(`(${likeClauses.join(' OR ')})`);
    columns.forEach(() => params.push(`%${query.search}%`));
  }
  if (query.startDate) {
    conditions.push(`date(created_at) >= date(?)`);
    params.push(query.startDate);
  }
  if (query.endDate) {
    conditions.push(`date(created_at) <= date(?)`);
    params.push(query.endDate);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  return { where, params };
}

app.prepare()
  .then(() => {
    const server = express();

    server.use(express.json());
    server.use('/uploads', express.static(uploadDir));

    server.get('/api/notes', async (req, res, next) => {
      try {
        const { where, params } = buildFilters(req.query, ['title', 'content', 'tags']);
        const rows = await all(`SELECT * FROM notes ${where} ORDER BY datetime(created_at) DESC`, params);
        res.json(rows.map(mapRow));
      } catch (error) {
        next(error);
      }
    });

    server.post('/api/notes', async (req, res, next) => {
      try {
        const { title, content, tags } = req.body;
        if (!title || !content) {
          return res.status(400).json({ error: 'Title and content are required.' });
        }
        const tagString = Array.isArray(tags) ? tags.join(',') : tags || '';
        const info = await run('INSERT INTO notes (title, content, tags) VALUES (?, ?, ?)', [title, content, tagString]);
        const note = await get('SELECT * FROM notes WHERE id = ?', [info.lastID]);
        res.status(201).json(mapRow(note));
      } catch (error) {
        next(error);
      }
    });

    server.put('/api/notes/:id', async (req, res, next) => {
      try {
        const { title, content, tags } = req.body;
        const tagString = Array.isArray(tags) ? tags.join(',') : tags || '';
        const info = await run('UPDATE notes SET title = ?, content = ?, tags = ? WHERE id = ?', [
          title,
          content,
          tagString,
          req.params.id
        ]);
        if (!info.changes) {
          return res.status(404).json({ error: 'Note not found.' });
        }
        const note = await get('SELECT * FROM notes WHERE id = ?', [req.params.id]);
        res.json(mapRow(note));
      } catch (error) {
        next(error);
      }
    });

    server.delete('/api/notes/:id', async (req, res, next) => {
      try {
        const info = await run('DELETE FROM notes WHERE id = ?', [req.params.id]);
        if (!info.changes) {
          return res.status(404).json({ error: 'Note not found.' });
        }
        res.status(204).end();
      } catch (error) {
        next(error);
      }
    });

    server.get('/api/links', async (req, res, next) => {
      try {
        const { where, params } = buildFilters(req.query, ['title', 'url', 'description', 'category', 'tags']);
        const rows = await all(`SELECT * FROM links ${where} ORDER BY datetime(created_at) DESC`, params);
        res.json(rows.map(mapRow));
      } catch (error) {
        next(error);
      }
    });

    server.post('/api/links', async (req, res, next) => {
      try {
        const { title, url, description = '', category = '', tags = '' } = req.body;
        if (!title || !url) {
          return res.status(400).json({ error: 'Title and URL are required.' });
        }
        const tagString = Array.isArray(tags) ? tags.join(',') : tags || '';
        const info = await run(
          'INSERT INTO links (title, url, description, category, tags) VALUES (?, ?, ?, ?, ?)',
          [title, url, description, category, tagString]
        );
        const link = await get('SELECT * FROM links WHERE id = ?', [info.lastID]);
        res.status(201).json(mapRow(link));
      } catch (error) {
        next(error);
      }
    });

    server.put('/api/links/:id', async (req, res, next) => {
      try {
        const { title, url, description = '', category = '', tags = '' } = req.body;
        const tagString = Array.isArray(tags) ? tags.join(',') : tags || '';
        const info = await run(
          'UPDATE links SET title = ?, url = ?, description = ?, category = ?, tags = ? WHERE id = ?',
          [title, url, description, category, tagString, req.params.id]
        );
        if (!info.changes) {
          return res.status(404).json({ error: 'Link not found.' });
        }
        const link = await get('SELECT * FROM links WHERE id = ?', [req.params.id]);
        res.json(mapRow(link));
      } catch (error) {
        next(error);
      }
    });

    server.delete('/api/links/:id', async (req, res, next) => {
      try {
        const info = await run('DELETE FROM links WHERE id = ?', [req.params.id]);
        if (!info.changes) {
          return res.status(404).json({ error: 'Link not found.' });
        }
        res.status(204).end();
      } catch (error) {
        next(error);
      }
    });

    server.get('/api/images', async (req, res, next) => {
      try {
        const { where, params } = buildFilters(req.query, ['original_name', 'caption', 'tags']);
        const rows = await all(`SELECT * FROM images ${where} ORDER BY datetime(created_at) DESC`, params);
        res.json(
          rows.map((row) => ({
            ...mapRow(row),
            url: `/uploads/${row.file_name}`
          }))
        );
      } catch (error) {
        next(error);
      }
    });

    server.post('/api/upload', upload.single('image'), async (req, res, next) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: 'No image uploaded.' });
        }
        const { caption = '', tags = '' } = req.body;
        const tagString = Array.isArray(tags) ? tags.join(',') : tags || '';
        const info = await run('INSERT INTO images (file_name, original_name, caption, tags) VALUES (?, ?, ?, ?)', [
          req.file.filename,
          req.file.originalname,
          caption,
          tagString
        ]);
        const image = await get('SELECT * FROM images WHERE id = ?', [info.lastID]);
        res.status(201).json({ ...mapRow(image), url: `/uploads/${image.file_name}` });
      } catch (error) {
        next(error);
      }
    });

    server.get('/api/search', async (req, res, next) => {
      try {
        const noteFilters = buildFilters(req.query, ['title', 'content', 'tags']);
        const linkFilters = buildFilters(req.query, ['title', 'url', 'description', 'category', 'tags']);
        const imageFilters = buildFilters(req.query, ['original_name', 'caption', 'tags']);

        const notes = await all(
          `SELECT * FROM notes ${noteFilters.where} ORDER BY datetime(created_at) DESC`,
          noteFilters.params
        );
        const links = await all(
          `SELECT * FROM links ${linkFilters.where} ORDER BY datetime(created_at) DESC`,
          linkFilters.params
        );
        const images = await all(
          `SELECT * FROM images ${imageFilters.where} ORDER BY datetime(created_at) DESC`,
          imageFilters.params
        );
        res.json({
          notes: notes.map(mapRow),
          links: links.map(mapRow),
          images: images.map((row) => ({
            ...mapRow(row),
            url: `/uploads/${row.file_name}`
          }))
        });
      } catch (error) {
        next(error);
      }
    });

    server.use((err, _req, res, _next) => {
      console.error(err);
      res.status(500).json({ error: err.message || 'Internal server error' });
    });

    server.all('*', (req, res) => handle(req, res));

    server.listen(port, (err) => {
      if (err) throw err;
      console.log(`> Ready on http://localhost:${port}`);
    });
  })
  .catch((err) => {
    console.error('Error starting server', err);
    process.exit(1);
  });
