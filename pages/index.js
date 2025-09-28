import { useCallback, useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';

const initialFilters = {
  search: '',
  startDate: '',
  endDate: ''
};

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short'
});

const fullDateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'full'
});

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function parseDate(value) {
  if (!value) return null;
  const normalized = value.includes('T') ? value : value.replace(' ', 'T');
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

function formatDateKey(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function formatDisplayDate(value) {
  const parsed = parseDate(value);
  if (!parsed) return value;
  return dateTimeFormatter.format(parsed);
}

function formatFullDate(value) {
  const parsed = parseDate(value);
  if (!parsed) return value;
  return fullDateFormatter.format(parsed);
}

function getMonthDays(baseDate) {
  const start = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
  const end = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0);
  const days = [];
  for (let current = new Date(start); current <= end; current.setDate(current.getDate() + 1)) {
    days.push(new Date(current));
  }
  return { start, days };
}

function TagList({ tags }) {
  if (!tags || !tags.length) return null;
  return (
    <div className="tag-list">
      {tags.map((tag) => (
        <span key={tag} className="tag">
          {tag}
        </span>
      ))}
    </div>
  );
}

function CalendarView({ notes, onSelect, activeDate }) {
  const today = new Date();
  const { start, days } = getMonthDays(today);
  const counts = useMemo(() => {
    return notes.reduce((acc, note) => {
      const key = formatDateKey(parseDate(note.created_at));
      if (!key) return acc;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }, [notes]);

  const firstDay = start.getDay();
  const blanks = Array(firstDay).fill(null);
  const cells = [...blanks, ...days];

  return (
    <div className="calendar">
      <div className="calendar-weekdays">
        {WEEKDAYS.map((weekday) => (
          <span key={weekday}>{weekday}</span>
        ))}
      </div>
      <div className="calendar-grid">
        {cells.map((day, index) => {
          if (!day) {
            return <div key={`empty-${index}`} className="calendar-day empty" />;
          }
          const key = formatDateKey(day);
          const hasNotes = counts[key];
          const isActive = activeDate === key;
          return (
            <div
              key={key}
              className={`calendar-day${isActive ? ' active' : ''}`}
              onClick={() => onSelect(key)}
              role="button"
              tabIndex={0}
            >
              <span>{day.getDate()}</span>
              {hasNotes ? <span className="count">{hasNotes} note{hasNotes > 1 ? 's' : ''}</span> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Home() {
  const [filters, setFilters] = useState(initialFilters);
  const [notes, setNotes] = useState([]);
  const [links, setLinks] = useState([]);
  const [images, setImages] = useState([]);
  const [noteForm, setNoteForm] = useState({ title: '', content: '', tags: '' });
  const [linkForm, setLinkForm] = useState({
    title: '',
    url: '',
    description: '',
    category: '',
    tags: ''
  });
  const [uploadForm, setUploadForm] = useState({ caption: '', tags: '' });
  const [imageFile, setImageFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeCalendarDate, setActiveCalendarDate] = useState('');

  const buildQuery = useCallback((params) => {
    const query = new URLSearchParams();
    if (params.search) query.set('search', params.search);
    if (params.startDate) query.set('startDate', params.startDate);
    if (params.endDate) query.set('endDate', params.endDate);
    return query.toString();
  }, []);

  const fetchCollections = useCallback(
    async (customFilters = filters) => {
      const queryString = buildQuery(customFilters);
      const queryPrefix = queryString ? `?${queryString}` : '';
      try {
        const [notesRes, linksRes, imagesRes] = await Promise.all([
          fetch(`/api/notes${queryPrefix}`),
          fetch(`/api/links${queryPrefix}`),
          fetch(`/api/images${queryPrefix}`)
        ]);

        if (!notesRes.ok || !linksRes.ok || !imagesRes.ok) {
          throw new Error('Unable to load content.');
        }

        const [notesData, linksData, imagesData] = await Promise.all([
          notesRes.json(),
          linksRes.json(),
          imagesRes.json()
        ]);
        setNotes(notesData);
        setLinks(linksData);
        setImages(imagesData);
      } catch (error) {
        console.error(error);
        alert('Something went wrong while loading content.');
      }
    },
    [buildQuery, filters]
  );

  useEffect(() => {
    fetchCollections();
  }, [fetchCollections]);

  const handleFilterSubmit = async (event) => {
    event.preventDefault();
    setActiveCalendarDate(filters.startDate === filters.endDate ? filters.startDate : '');
    await fetchCollections(filters);
  };

  const handleClearFilters = async () => {
    const reset = { ...initialFilters };
    setFilters(reset);
    setActiveCalendarDate('');
    await fetchCollections(reset);
  };

  const handleNoteSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(noteForm)
      });
      if (!res.ok) throw new Error('Failed to create note');
      setNoteForm({ title: '', content: '', tags: '' });
      await fetchCollections();
    } catch (error) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteNote = async (id) => {
    if (!confirm('Delete this note?')) return;
    try {
      const res = await fetch(`/api/notes/${id}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 204) throw new Error('Failed to delete note');
      await fetchCollections();
    } catch (error) {
      alert(error.message);
    }
  };

  const handleLinkSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(linkForm)
      });
      if (!res.ok) throw new Error('Failed to save link');
      setLinkForm({ title: '', url: '', description: '', category: '', tags: '' });
      await fetchCollections();
    } catch (error) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteLink = async (id) => {
    if (!confirm('Delete this link?')) return;
    try {
      const res = await fetch(`/api/links/${id}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 204) throw new Error('Failed to delete link');
      await fetchCollections();
    } catch (error) {
      alert(error.message);
    }
  };

  const handleImageSubmit = async (event) => {
    event.preventDefault();
    if (!imageFile) {
      alert('Please choose an image to upload.');
      return;
    }
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('image', imageFile);
      if (uploadForm.caption) formData.append('caption', uploadForm.caption);
      if (uploadForm.tags) formData.append('tags', uploadForm.tags);
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      if (!res.ok) throw new Error('Failed to upload image');
      setImageFile(null);
      setUploadForm({ caption: '', tags: '' });
      (document.getElementById('image-upload-input') || {}).value = '';
      await fetchCollections();
    } catch (error) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  const groupedLinks = useMemo(() => {
    return links.reduce((acc, link) => {
      const key = link.category || 'Uncategorised';
      if (!acc[key]) acc[key] = [];
      acc[key].push(link);
      return acc;
    }, {});
  }, [links]);

  const activeDateNotes = useMemo(() => {
    if (!activeCalendarDate) return [];
    return notes.filter((note) => {
      const parsed = parseDate(note.created_at);
      if (!parsed) return false;
      return formatDateKey(parsed) === activeCalendarDate;
    });
  }, [activeCalendarDate, notes]);

  const applyCalendarFilter = async (dateKey) => {
    const nextKey = activeCalendarDate === dateKey ? '' : dateKey;
    setActiveCalendarDate(nextKey);
    const nextFilters = {
      ...filters,
      startDate: nextKey,
      endDate: nextKey
    };
    setFilters(nextFilters);
    await fetchCollections(nextKey ? nextFilters : { ...initialFilters });
  };

  return (
    <main>
      <header>
        <h1>My Digital Garden</h1>
        <p>Capture ideas, curate resources, and keep everything searchable.</p>
      </header>

      <section>
        <div className="section-header">
          <h2>Search &amp; Filter</h2>
          <button className="secondary" type="button" onClick={handleClearFilters}>
            Clear filters
          </button>
        </div>
        <form className="filters" onSubmit={handleFilterSubmit}>
          <div>
            <label htmlFor="search">Search</label>
            <input
              id="search"
              type="text"
              placeholder="Search notes, links, images..."
              value={filters.search}
              onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
            />
          </div>
          <div>
            <label htmlFor="startDate">Start date</label>
            <input
              id="startDate"
              type="date"
              value={filters.startDate}
              onChange={(event) => setFilters((prev) => ({ ...prev, startDate: event.target.value }))}
            />
          </div>
          <div>
            <label htmlFor="endDate">End date</label>
            <input
              id="endDate"
              type="date"
              value={filters.endDate}
              onChange={(event) => setFilters((prev) => ({ ...prev, endDate: event.target.value }))}
            />
          </div>
          <button type="submit" disabled={loading}>
            Apply filters
          </button>
        </form>
      </section>

      <section>
        <div className="section-header">
          <h2>Notebook</h2>
          <span className="empty-state">Markdown supported</span>
        </div>
        <form onSubmit={handleNoteSubmit}>
          <div>
            <label htmlFor="note-title">Title</label>
            <input
              id="note-title"
              type="text"
              value={noteForm.title}
              onChange={(event) => setNoteForm((prev) => ({ ...prev, title: event.target.value }))}
              placeholder="Note title"
              required
            />
          </div>
          <div>
            <label htmlFor="note-content">Content</label>
            <textarea
              id="note-content"
              value={noteForm.content}
              onChange={(event) => setNoteForm((prev) => ({ ...prev, content: event.target.value }))}
              placeholder="Write your note using Markdown..."
              required
            />
          </div>
          <div>
            <label htmlFor="note-tags">Tags (comma separated)</label>
            <input
              id="note-tags"
              type="text"
              value={noteForm.tags}
              onChange={(event) => setNoteForm((prev) => ({ ...prev, tags: event.target.value }))}
              placeholder="writing, ideas, project"
            />
          </div>
          <button type="submit" disabled={loading}>
            Save note
          </button>
        </form>

        <div className="note-grid" style={{ marginTop: '1.5rem' }}>
          {notes.length === 0 ? (
            <p className="empty-state">No notes yet. Capture your first idea above.</p>
          ) : (
            notes.map((note) => (
              <article key={note.id} className="note-card">
                <div>
                  <h3>{note.title}</h3>
                  <small>{formatDisplayDate(note.created_at)}</small>
                </div>
                <ReactMarkdown className="markdown">{note.content}</ReactMarkdown>
                <TagList tags={note.tags} />
                <button className="secondary" type="button" onClick={() => handleDeleteNote(note.id)}>
                  Delete
                </button>
              </article>
            ))
          )}
        </div>
      </section>

      <section>
        <div className="section-header">
          <h2>Quick Calendar</h2>
          <span className="empty-state">Tap a date to filter notes</span>
        </div>
        <CalendarView notes={notes} onSelect={applyCalendarFilter} activeDate={activeCalendarDate} />
        {activeDateNotes.length > 0 && parseDate(`${activeCalendarDate}T00:00:00`) && (
          <div style={{ marginTop: '1rem' }}>
            <h3>
              Notes on {formatFullDate(`${activeCalendarDate}T00:00:00`)}
            </h3>
            <div className="note-grid">
              {activeDateNotes.map((note) => (
                <article key={`calendar-${note.id}`} className="note-card">
                  <div>
                    <h3>{note.title}</h3>
                    <small>{formatDisplayDate(note.created_at)}</small>
                  </div>
                  <ReactMarkdown className="markdown">{note.content}</ReactMarkdown>
                  <TagList tags={note.tags} />
                </article>
              ))}
            </div>
          </div>
        )}
      </section>

      <section>
        <h2>Resource Library</h2>
        <form onSubmit={handleLinkSubmit}>
          <div>
            <label htmlFor="link-title">Title</label>
            <input
              id="link-title"
              type="text"
              value={linkForm.title}
              onChange={(event) => setLinkForm((prev) => ({ ...prev, title: event.target.value }))}
              placeholder="Resource title"
              required
            />
          </div>
          <div>
            <label htmlFor="link-url">URL</label>
            <input
              id="link-url"
              type="url"
              value={linkForm.url}
              onChange={(event) => setLinkForm((prev) => ({ ...prev, url: event.target.value }))}
              placeholder="https://"
              required
            />
          </div>
          <div>
            <label htmlFor="link-description">Description</label>
            <textarea
              id="link-description"
              value={linkForm.description}
              onChange={(event) => setLinkForm((prev) => ({ ...prev, description: event.target.value }))}
              placeholder="Why is this link valuable?"
            />
          </div>
          <div>
            <label htmlFor="link-category">Category</label>
            <input
              id="link-category"
              type="text"
              value={linkForm.category}
              onChange={(event) => setLinkForm((prev) => ({ ...prev, category: event.target.value }))}
              placeholder="Design, Research, Learning..."
            />
          </div>
          <div>
            <label htmlFor="link-tags">Tags (comma separated)</label>
            <input
              id="link-tags"
              type="text"
              value={linkForm.tags}
              onChange={(event) => setLinkForm((prev) => ({ ...prev, tags: event.target.value }))}
            />
          </div>
          <button type="submit" disabled={loading}>
            Save link
          </button>
        </form>

        {Object.keys(groupedLinks).length === 0 ? (
          <p className="empty-state" style={{ marginTop: '1.5rem' }}>
            No links yet. Save a useful resource above.
          </p>
        ) : (
          Object.entries(groupedLinks).map(([category, items]) => (
            <div key={category} style={{ marginTop: '1.5rem' }}>
              <h3>{category}</h3>
              <div className="link-grid">
                {items.map((link) => (
                  <article key={link.id} className="link-card">
                    <div>
                      <h4>
                        <a href={link.url} target="_blank" rel="noreferrer">
                          {link.title}
                        </a>
                      </h4>
                      <small>{formatDisplayDate(link.created_at)}</small>
                    </div>
                    {link.description ? <p>{link.description}</p> : null}
                    <TagList tags={link.tags} />
                    <button className="secondary" type="button" onClick={() => handleDeleteLink(link.id)}>
                      Delete
                    </button>
                  </article>
                ))}
              </div>
            </div>
          ))
        )}
      </section>

      <section>
        <h2>Image Journal</h2>
        <form onSubmit={handleImageSubmit}>
          <div>
            <label htmlFor="image-upload-input">Image</label>
            <input
              id="image-upload-input"
              type="file"
              accept="image/*"
              onChange={(event) => setImageFile(event.target.files?.[0] || null)}
              required
            />
          </div>
          <div>
            <label htmlFor="image-caption">Caption</label>
            <input
              id="image-caption"
              type="text"
              value={uploadForm.caption}
              onChange={(event) => setUploadForm((prev) => ({ ...prev, caption: event.target.value }))}
              placeholder="Image caption"
            />
          </div>
          <div>
            <label htmlFor="image-tags">Tags (comma separated)</label>
            <input
              id="image-tags"
              type="text"
              value={uploadForm.tags}
              onChange={(event) => setUploadForm((prev) => ({ ...prev, tags: event.target.value }))}
              placeholder="travel, inspiration"
            />
          </div>
          <button type="submit" disabled={loading}>
            Upload image
          </button>
        </form>

        <div className="image-grid" style={{ marginTop: '1.5rem' }}>
          {images.length === 0 ? (
            <p className="empty-state">No images uploaded yet.</p>
          ) : (
            images.map((image) => (
              <figure key={image.id} className="image-card">
                <img src={image.url} alt={image.caption || image.original_name} />
                <figcaption>
                  <strong>{image.caption || image.original_name}</strong>
                  <br />
                  <small>{formatDisplayDate(image.created_at)}</small>
                </figcaption>
                <TagList tags={image.tags} />
              </figure>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
