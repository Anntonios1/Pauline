import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { AuthProvider } from './contexts/AuthContext'
import { DataProvider } from './contexts/DataContext'
import { FeedSocketProvider } from './contexts/FeedSocketContext'
import { ThemeProvider } from './contexts/ThemeContext'
import './styles/index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <BrowserRouter future={{ v7_relativeSplatPath: true }}>
        <AuthProvider>
          <DataProvider>
            {/* Dentro de DataProvider: necesita su refreshPublications. */}
            <FeedSocketProvider>
              <App />
            </FeedSocketProvider>
          </DataProvider>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  </React.StrictMode>,
)
