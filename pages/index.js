import { useState, useEffect } from 'react';
import { useAuth } from '../lib/auth-context';
import { useRouter } from 'next/router';

export default function Home() {
  const { user, loading: authLoading, signIn, signOut, isAuthenticated } = useAuth();
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [savedMessages, setSavedMessages] = useState([]);

  // Redirect to sign in if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/auth/signin');
    }
  }, [authLoading, isAuthenticated, router]);

  // Load messages when user is authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchAllMessages();
    }
  }, [isAuthenticated]);

  const handleButtonClick = async () => {
    if (!inputValue.trim()) {
      setMessage('Please enter some text first!');
      return;
    }

    setLoading(true);
    try {
      // Save to database
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: inputValue }),
      });

      if (response.ok) {
        const result = await response.json();
        setMessage(`✅ Saved to database! ID: ${result.message.id}`);
        
        // Fetch all messages to show them
        await fetchAllMessages();
      } else {
        setMessage('❌ Failed to save to database');
      }
    } catch (error) {
      console.error('Error:', error);
      setMessage('❌ Error saving to database');
    } finally {
      setLoading(false);
    }
  };

  const fetchAllMessages = async () => {
    try {
      const response = await fetch('/api/messages');
      if (response.ok) {
        const data = await response.json();
        setSavedMessages(data.messages);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const handleDeleteMessage = async (msg) => {
    // Optimistically update UI
    setSavedMessages((prev) => prev.filter((m) => m.id !== msg.id));
    try {
      await fetch('/api/messages', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: msg.id }),
      });
    } catch (err) {
      // If error, revert UI change (optional)
      setSavedMessages((prev) => [...prev, msg]);
      alert('Failed to delete message.');
    }
  };

  const handleInputChange = (e) => {
    setInputValue(e.target.value);
  };

  // Show loading while checking authentication
  if (authLoading) {
    return (
      <main style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <div>Loading...</div>
      </main>
    );
  }

  // Don't render anything if not authenticated (will redirect)
  if (!isAuthenticated) {
    return null;
  }

  return (
    <main>
      <header>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <h1>Learning React Basics</h1>
            <p>A simple page to practice React fundamentals with database storage</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {user && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {user.image && (
                  <img 
                    src={user.image} 
                    alt={user.name} 
                    style={{ width: '32px', height: '32px', borderRadius: '50%' }}
                  />
                )}
                <span>Welcome, {user.name}!</span>
              </div>
            )}
            <button
              onClick={() => signOut()}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <section>
        <div style={{ marginBottom: '1rem' }}>
          <input 
            onChange={handleInputChange} 
            type="text" 
            placeholder="Enter your message" 
            value={inputValue}
            style={{
              padding: '0.5rem',
              marginRight: '0.5rem',
              borderRadius: '4px',
              border: '1px solid #ccc',
              width: '200px'
            }}
          />
          <button 
            onClick={handleButtonClick} 
            disabled={loading}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: loading ? '#ccc' : '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Saving...' : 'Save to Database'}
          </button>
        </div>
        
        {message && (
          <div className="message">
            <p>{message}</p>
          </div>
        )}

        {savedMessages.length > 0 && (
          <div style={{ marginTop: '2rem' }}>
            <h3>Saved Messages:</h3>
            <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #ccc', padding: '1rem', borderRadius: '4px' }}>
              {savedMessages.map((msg) => (
                <div key={msg.id} style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem', padding: '0.5rem', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
                  <button
                    onClick={() => handleDeleteMessage(msg)}
                    style={{
                      marginRight: '0.75rem',
                      backgroundColor: '#dc3545',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '0.25rem 0.5rem',
                      cursor: 'pointer'
                    }}
                    title="Delete message"
                  >
                    &#10005;
                  </button>
                  <span>
                    <strong>ID:</strong> {msg.id} | 
                    <strong> Text:</strong> {msg.text} | 
                    <strong> Date:</strong> {msg.date} | 
                    <strong> Time:</strong> {msg.time}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
