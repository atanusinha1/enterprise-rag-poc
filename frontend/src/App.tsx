import { useState, useEffect, useRef, DragEvent, ChangeEvent } from 'react';
import { 
  BrainCircuit, 
  Database, 
  UploadCloud, 
  FileText, 
  MessageSquare, 
  Search, 
  Trash2, 
  Send, 
  Layers, 
  BookOpen, 
  Settings, 
  RefreshCw,
  X,
  FileDown
} from 'lucide-react';
import './App.css';

// Types matching Backend DTOs
interface DocumentSummary {
  fileName: string;
  chunksCount: number;
  totalPages: number;
}

interface SearchResultItem {
  fileName: string;
  content: string;
  pageNumber: number;
  chunkIndex: number;
  similarityScore: number;
}

interface ChatMessage {
  sender: 'user' | 'assistant';
  text: string;
  citations?: SearchResultItem[];
}

export default function App() {
  // 1. Navigation & API Settings States
  const [activeTab, setActiveTab] = useState<'dashboard' | 'console'>('dashboard');
  const [consoleMode, setConsoleMode] = useState<'chat' | 'search'>('chat');
  const [apiBaseUrl, setApiBaseUrl] = useState<string>(() => {
    return localStorage.getItem('rag_api_base_url') || 'http://localhost:5084';
  });
  const [apiConnected, setApiConnected] = useState<boolean | null>(null);
  const [isCheckingConnection, setIsCheckingConnection] = useState<boolean>(false);

  // 2. Documents & Ingestion States
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState<boolean>(false);
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [uploadingFile, setUploadingFile] = useState<File | null>(null);

  // 3. RAG Console States
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState<string>('');
  const [isChatLoading, setIsChatLoading] = useState<boolean>(false);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [isSearchLoading, setIsSearchLoading] = useState<boolean>(false);

  // 4. Modal State
  const [selectedCitation, setSelectedCitation] = useState<SearchResultItem | null>(null);

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Save API Base URL to LocalStorage and re-verify connection
  useEffect(() => {
    localStorage.setItem('rag_api_base_url', apiBaseUrl);
    checkConnection();
  }, [apiBaseUrl]);

  // Scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, isChatLoading]);

  // Load documents list on startup or when API URL changes
  useEffect(() => {
    if (apiConnected) {
      loadDocuments();
    }
  }, [apiConnected]);

  // Ping backend to check if running
  const checkConnection = async () => {
    setIsCheckingConnection(true);
    try {
      const response = await fetch(`${apiBaseUrl}/api/documents`);
      if (response.ok) {
        setApiConnected(true);
      } else {
        setApiConnected(false);
      }
    } catch {
      setApiConnected(false);
    } finally {
      setIsCheckingConnection(false);
    }
  };

  // Load documents summary from backend
  const loadDocuments = async () => {
    setIsLoadingDocs(true);
    try {
      const response = await fetch(`${apiBaseUrl}/api/documents`);
      if (response.ok) {
        const data = await response.json();
        setDocuments(data);
      }
    } catch (err) {
      console.error('Error fetching documents:', err);
    } finally {
      setIsLoadingDocs(false);
    }
  };

  // Delete Document
  const handleDeleteDocument = async (fileName: string) => {
    if (!confirm(`Are you sure you want to delete "${fileName}" and all its vector embeddings?`)) {
      return;
    }
    try {
      const response = await fetch(`${apiBaseUrl}/api/documents/${encodeURIComponent(fileName)}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        loadDocuments();
        // Clear chat history as references might be obsolete
        setChatHistory([]);
        setSearchResults([]);
      } else {
        const errData = await response.json();
        alert(`Delete failed: ${errData.error || response.statusText}`);
      }
    } catch (err) {
      alert(`Error connection to API: ${err}`);
    }
  };

  // Drag and Drop files handlers
  const handleDrag = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        await uploadFile(file);
      } else {
        alert('Only PDF files are supported for ingestion.');
      }
    }
  };

  const handleFileInputChange = async (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await uploadFile(e.target.files[0]);
    }
  };

  const triggerFileBrowser = () => {
    fileInputRef.current?.click();
  };

  // Upload file and simulate chunk ingestion progress
  const uploadFile = async (file: File) => {
    setUploadingFile(file);
    setUploadProgress(10);
    setUploadStatus('Uploading PDF to backend...');

    const formData = new FormData();
    formData.append('file', file);

    try {
      // Simulate progress bar movement during network processing
      const interval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 85) {
            clearInterval(interval);
            return 85;
          }
          return prev + 5;
        });
      }, 500);

      const response = await fetch(`${apiBaseUrl}/api/documents/upload`, {
        method: 'POST',
        body: formData
      });

      clearInterval(interval);

      if (response.ok) {
        setUploadProgress(100);
        setUploadStatus('Processing completed! Vectorized and saved to pgvector.');
        setTimeout(() => {
          setUploadingFile(null);
          loadDocuments();
        }, 1500);
      } else {
        const data = await response.json();
        setUploadStatus(`Error: ${data.error || 'Ingestion failed'}`);
        setUploadProgress(0);
      }
    } catch (err) {
      setUploadStatus(`Network error: ${err}`);
      setUploadProgress(0);
    }
  };

  // Submit chat question (RAG Ask)
  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isChatLoading) return;

    const userText = chatInput;
    setChatInput('');
    setChatHistory(prev => [...prev, { sender: 'user', text: userText }]);
    setIsChatLoading(true);

    try {
      const response = await fetch(`${apiBaseUrl}/api/chat/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: userText })
      });

      if (response.ok) {
        const data = await response.json();
        setChatHistory(prev => [...prev, {
          sender: 'assistant',
          text: data.answer,
          citations: data.citations
        }]);
      } else {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || `Server returned error ${response.status} (${response.statusText})`;
        setChatHistory(prev => [...prev, {
          sender: 'assistant',
          text: `Backend Error: ${errorMessage}`
        }]);
      }
    } catch (err) {
      setChatHistory(prev => [...prev, {
        sender: 'assistant',
        text: `Error connecting to AI backend: ${err}`
      }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // Submit pure semantic search
  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || isSearchLoading) return;

    setIsSearchLoading(true);
    try {
      const response = await fetch(`${apiBaseUrl}/api/chat/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery, limit: 5 })
      });

      if (response.ok) {
        const data = await response.json();
        setSearchResults(data);
      } else {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || `Server returned error ${response.status} (${response.statusText})`;
        alert(`Search Failed: ${errorMessage}`);
      }
    } catch (err) {
      alert(`Error fetching from backend: ${err}`);
    } finally {
      setIsSearchLoading(false);
    }
  };

  // Calculate Aggregated Metrics
  const totalDocuments = documents.length;
  const totalChunks = documents.reduce((acc, curr) => acc + curr.chunksCount, 0);
  const totalPages = documents.reduce((acc, curr) => acc + curr.totalPages, 0);

  return (
    <div className="app-container">
      {/* Top Banner Navigation Header */}
      <header className="app-header">
        <div className="brand-section">
          <div className="brand-logo">
            <BrainCircuit size={18} />
          </div>
          <div>
            <h1 className="brand-title">Antigravity RAG</h1>
            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Enterprise POC Assistant</span>
          </div>
          <span className="brand-tag">SK v1.14</span>
        </div>

        <nav className="nav-tabs">
          <button 
            className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <Database size={16} />
            Data Ingestion
          </button>
          <button 
            className={`tab-btn ${activeTab === 'console' ? 'active' : ''}`}
            onClick={() => setActiveTab('console')}
          >
            <MessageSquare size={16} />
            RAG Assistant
          </button>
        </nav>

        <div className="api-settings">
          <div className="api-input-wrapper">
            <Settings size={14} style={{ color: 'var(--text-muted)', marginRight: '0.25rem' }} />
            <input 
              type="text" 
              className="api-input"
              value={apiBaseUrl}
              onChange={(e) => setApiBaseUrl(e.target.value)}
              placeholder="Backend API Base URL" 
            />
          </div>
          <button 
            onClick={checkConnection}
            disabled={isCheckingConnection}
            style={{ 
              background: 'transparent', 
              border: 'none', 
              cursor: 'pointer', 
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center'
            }}
            title="Check Backend Connection"
          >
            <RefreshCw size={14} className={isCheckingConnection ? 'spin-anim' : ''} />
          </button>
          <span 
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              backgroundColor: apiConnected === true ? 'var(--success)' : apiConnected === false ? 'var(--error)' : 'var(--warning)',
              boxShadow: apiConnected === true ? '0 0 8px var(--success)' : 'none'
            }}
            title={apiConnected === true ? 'Connected' : apiConnected === false ? 'Disconnected' : 'Checking status...'}
          />
        </div>
      </header>

      {/* Main Content Workspace */}
      <main className="main-content">
        {/* Metric Cards Banner */}
        <section className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">
              <FileText size={20} />
            </div>
            <div className="stat-info">
              <h4>Indexed Files</h4>
              <p>{totalDocuments}</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">
              <Layers size={20} />
            </div>
            <div className="stat-info">
              <h4>Postgres Vectors</h4>
              <p>{totalChunks}</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">
              <BookOpen size={20} />
            </div>
            <div className="stat-info">
              <h4>Total Pages Ingested</h4>
              <p>{totalPages}</p>
            </div>
          </div>
        </section>

        {/* Tab 1: Dashboard and Ingestion */}
        {activeTab === 'dashboard' && (
          <div className="dashboard-grid">
            {/* Ingestion Panel */}
            <div className="panel-card">
              <h3 className="panel-title">
                <UploadCloud size={18} style={{ color: 'var(--accent-purple)' }} />
                Document Vector Ingestion
              </h3>
              
              {!uploadingFile ? (
                <div 
                  className={`dropzone ${dragActive ? 'active' : ''}`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  onClick={triggerFileBrowser}
                >
                  <UploadCloud size={48} className="dropzone-icon" />
                  <p className="dropzone-text">Drag and drop your PDF here, or <strong>browse files</strong></p>
                  <p className="dropzone-subtext">PDF text is automatically extracted, segmented into sliding-window chunks, vectorized via Azure OpenAI, and stored in pgvector.</p>
                  <input 
                    type="file" 
                    ref={fileInputRef}
                    onChange={handleFileInputChange}
                    className="file-input" 
                    accept=".pdf" 
                  />
                </div>
              ) : (
                <div className="dropzone active" style={{ cursor: 'default' }}>
                  <FileDown size={48} className="dropzone-icon" style={{ color: 'var(--accent-indigo)' }} />
                  <div className="upload-progress-container">
                    <div className="upload-file-info">
                      <span className="upload-file-name">{uploadingFile.name}</span>
                      <span className="upload-file-status">{uploadProgress}%</span>
                    </div>
                    <div className="progress-track">
                      <div className="progress-bar" style={{ width: `${uploadProgress}%` }}></div>
                    </div>
                    <p style={{ fontSize: '0.75rem', marginTop: '0.75rem', color: 'var(--text-secondary)' }}>
                      {uploadStatus}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Document Library Panel */}
            <div className="panel-card">
              <h3 className="panel-title">
                <Database size={18} style={{ color: 'var(--accent-indigo)' }} />
                Document Store Library
              </h3>

              {isLoadingDocs ? (
                <div className="empty-state">
                  <RefreshCw size={24} className="spin-anim" />
                  <p>Loading document registry...</p>
                </div>
              ) : documents.length === 0 ? (
                <div className="empty-state">
                  <FileText size={40} className="empty-state-icon" />
                  <p>No documents uploaded yet.</p>
                  <p style={{ fontSize: '0.75rem' }}>Upload a PDF in the ingestion panel to create vector indexes.</p>
                </div>
              ) : (
                <div className="doc-list">
                  {documents.map((doc, idx) => (
                    <div className="doc-item" key={idx}>
                      <div className="doc-meta">
                        <FileText size={18} className="doc-icon" />
                        <div>
                          <p className="doc-name" title={doc.fileName}>{doc.fileName}</p>
                          <div className="doc-stats">
                            <span>Pages: {doc.totalPages}</span>
                            <span>•</span>
                            <span>Vectors: {doc.chunksCount}</span>
                          </div>
                        </div>
                      </div>
                      <button 
                        className="doc-delete-btn"
                        onClick={() => handleDeleteDocument(doc.fileName)}
                        title="Delete Document Vector Index"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: RAG / QA Console */}
        {activeTab === 'console' && (
          <div className="console-container">
            <div className="console-body">
              {/* RAG Sub Navigation Mode */}
              <div className="console-tabs">
                <button 
                  className={`console-tab-btn ${consoleMode === 'chat' ? 'active' : ''}`}
                  onClick={() => setConsoleMode('chat')}
                >
                  <MessageSquare size={14} style={{ marginRight: '0.35rem', verticalAlign: 'middle' }} />
                  Enterprise Chat Assistant
                </button>
                <button 
                  className={`console-tab-btn ${consoleMode === 'search' ? 'active' : ''}`}
                  onClick={() => setConsoleMode('search')}
                >
                  <Search size={14} style={{ marginRight: '0.35rem', verticalAlign: 'middle' }} />
                  Semantic Search Only
                </button>
              </div>

              {/* Console Pane: Chat Mode */}
              {consoleMode === 'chat' && (
                <div className="chat-window">
                  <div className="chat-history">
                    {chatHistory.length === 0 ? (
                      <div className="empty-state">
                        <BrainCircuit size={44} className="empty-state-icon" style={{ color: 'var(--accent-purple)' }} />
                        <p style={{ fontWeight: 600 }}>Ask the Enterprise RAG Assistant</p>
                        <p style={{ fontSize: '0.8rem', maxWidth: '380px' }}>
                          Enter queries relating to uploaded documents. The assistant will retrieve relevant contexts from pgvector and formulate answers with citations.
                        </p>
                      </div>
                    ) : (
                      chatHistory.map((msg, idx) => (
                        <div key={idx} className={`message-bubble ${msg.sender}`}>
                          <p style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</p>
                          
                          {/* Render Citation source tags if available */}
                          {msg.citations && msg.citations.length > 0 && (
                            <div className="citations-panel">
                              <span className="citations-header">
                                <Database size={10} />
                                Document Citations:
                              </span>
                              <div className="citations-list">
                                {msg.citations.map((cite, cIdx) => (
                                  <span 
                                    key={cIdx} 
                                    className="citation-tag"
                                    onClick={() => setSelectedCitation(cite)}
                                    title={`Similarity: ${(cite.similarityScore * 100).toFixed(1)}%`}
                                  >
                                    {cite.fileName} (p. {cite.pageNumber})
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                    
                    {isChatLoading && (
                      <div className="message-bubble assistant">
                        <div className="typing-loader">
                          <span className="typing-dot"></span>
                          <span className="typing-dot"></span>
                          <span className="typing-dot"></span>
                        </div>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>

                  <form className="chat-input-bar" onSubmit={handleChatSubmit}>
                    <input 
                      type="text" 
                      className="chat-input"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder={totalDocuments === 0 ? "Upload documents first to start chatting..." : "Ask questions about your uploaded documents..."}
                      disabled={totalDocuments === 0 || isChatLoading}
                    />
                    <button 
                      type="submit" 
                      className="send-btn"
                      disabled={!chatInput.trim() || isChatLoading}
                    >
                      <Send size={16} />
                    </button>
                  </form>
                </div>
              )}

              {/* Console Pane: Pure Vector Search Mode */}
              {consoleMode === 'search' && (
                <div className="search-window">
                  <form style={{ display: 'flex', gap: '0.75rem' }} onSubmit={handleSearchSubmit}>
                    <input 
                      type="text" 
                      className="chat-input"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Enter search query to test cosine similarity..." 
                    />
                    <button 
                      type="submit" 
                      className="send-btn"
                      disabled={!searchQuery.trim() || isSearchLoading}
                      style={{ width: 'auto', padding: '0 1.25rem', display: 'flex', gap: '0.5rem' }}
                    >
                      <Search size={16} />
                      Run Search
                    </button>
                  </form>

                  <div className="search-results">
                    {isSearchLoading ? (
                      <div className="empty-state">
                        <RefreshCw size={24} className="spin-anim" />
                        <p>Performing Vector Math Search...</p>
                      </div>
                    ) : searchResults.length === 0 ? (
                      <div className="empty-state">
                        <Search size={40} className="empty-state-icon" />
                        <p>No search results. Enter a query above.</p>
                      </div>
                    ) : (
                      searchResults.map((result, idx) => (
                        <div key={idx} className="search-result-card">
                          <div className="search-result-meta">
                            <span className="result-doc-name">
                              <FileText size={12} style={{ color: '#ef4444' }} />
                              {result.fileName} (Page {result.pageNumber}, Chunk {result.chunkIndex})
                            </span>
                            <span className="score-badge">
                              Similarity: {(result.similarityScore * 100).toFixed(2)}%
                            </span>
                          </div>
                          <div className="search-result-content">
                            {result.content}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Citation Popover Detail Modal */}
      {selectedCitation && (
        <div className="citation-modal-overlay" onClick={() => setSelectedCitation(null)}>
          <div className="citation-modal" onClick={(e) => e.stopPropagation()}>
            <div className="citation-modal-header">
              <h3 style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FileText size={16} style={{ color: '#ef4444' }} />
                Source Details: {selectedCitation.fileName}
              </h3>
              <button className="citation-modal-close" onClick={() => setSelectedCitation(null)}>
                <X size={18} />
              </button>
            </div>
            
            <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              <span><strong>Page:</strong> {selectedCitation.pageNumber}</span>
              <span>•</span>
              <span><strong>Chunk Index:</strong> {selectedCitation.chunkIndex}</span>
              <span>•</span>
              <span><strong>Cosine Similarity:</strong> {(selectedCitation.similarityScore * 100).toFixed(2)}%</span>
            </div>

            <div className="citation-modal-body">
              {selectedCitation.content}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
