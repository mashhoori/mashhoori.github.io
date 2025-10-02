import { initDatabase, saveUser, saveMessage, getAllMessages, deleteMessage } from '../../lib/database';
import { getServerSession } from 'next-auth/next';

// Initialize database on startup
let dbInitialized = false;

async function initializeDB() {
  if (!dbInitialized) {
    await initDatabase();
    dbInitialized = true;
  }
}

export default async function handler(req, res) {
  // Initialize database
  await initializeDB();

  // Check authentication
  const session = await getServerSession(req, res);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Save user to database if not exists
  try {
    await saveUser({
      id: session.user.email, // Using email as ID for simplicity
      email: session.user.email,
      name: session.user.name,
      image: session.user.image
    });
  } catch (error) {
    console.error('Error saving user:', error);
  }

  if (req.method === 'POST') {
    // Save a new message
    try {
      const { text } = req.body;
      
      if (!text) {
        return res.status(400).json({ error: 'Text is required' });
      }

      const message = await saveMessage(text, session.user.email);
      res.status(201).json({ success: true, message });
    } catch (error) {
      console.error('Error saving message:', error);
      res.status(500).json({ error: 'Failed to save message' });
    }
  } else if (req.method === 'GET') {
    // Get all messages for the authenticated user
    try {
      const messages = await getAllMessages(session.user.email);
      res.status(200).json({ messages });
    } catch (error) {
      console.error('Error fetching messages:', error);
      res.status(500).json({ error: 'Failed to fetch messages' });
    }
  }
  else if (req.method === 'DELETE') {
    // Delete a message (only if it belongs to the user)
    try {
      const {id} = req.body;
      await deleteMessage(id, session.user.email);
      res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error deleting message:', error);
      res.status(500).json({ error: 'Failed to delete message' });
    }
  } else {
    res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
