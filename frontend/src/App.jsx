import { CssBaseline, GlobalStyles, ThemeProvider, createTheme } from '@mui/material'
import { RouterProvider } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useEffect, useMemo, useState } from 'react'
import { router } from './app/router'
import { ColorModeContext } from './theme/ColorModeContext'

const colorModeStorageKey = 'stockIssueColorMode'

function getInitialColorMode() {
  const savedMode = localStorage.getItem(colorModeStorageKey)

  if (savedMode === 'dark' || savedMode === 'light') {
    return savedMode
  }

  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function App() {
  const [mode, setMode] = useState(getInitialColorMode)
  const isDarkMode = mode === 'dark'
  const colorMode = useMemo(
    () => ({
      mode,
      toggleColorMode: () =>
        setMode((currentMode) => {
          const nextMode = currentMode === 'dark' ? 'light' : 'dark'

          localStorage.setItem(colorModeStorageKey, nextMode)
          return nextMode
        }),
    }),
    [mode],
  )
  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode,
          background: {
            default: isDarkMode ? '#0f172a' : '#f5f7fb',
            paper: isDarkMode ? '#111827' : '#ffffff',
          },
          primary: {
            main: '#2563eb',
          },
          text: {
            primary: isDarkMode ? '#e5e7eb' : '#111827',
            secondary: isDarkMode ? '#94a3b8' : '#64748b',
          },
        },
        shape: {
          borderRadius: 8,
        },
      }),
    [isDarkMode, mode],
  )

  useEffect(() => {
    document.body.dataset.colorMode = mode
  }, [mode])

  return (
    <ColorModeContext.Provider value={colorMode}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <GlobalStyles
          styles={{
            body: {
              backgroundColor: isDarkMode ? '#0f172a' : '#f5f7fb',
            },
            'body[data-color-mode="dark"] #root': {
              backgroundColor: '#0f172a',
            },
            'body[data-color-mode="dark"] .MuiCard-root, body[data-color-mode="dark"] .MuiDialog-paper, body[data-color-mode="dark"] .MuiMenu-paper': {
              backgroundColor: '#111827 !important',
              borderColor: '#334155 !important',
              color: '#e5e7eb !important',
            },
            'body[data-color-mode="dark"] .MuiTableContainer-root': {
              backgroundColor: '#111827 !important',
              borderColor: '#334155 !important',
            },
            'body[data-color-mode="dark"] .MuiTableCell-root': {
              backgroundColor: '#111827 !important',
              borderColor: '#334155 !important',
              color: '#e5e7eb !important',
            },
            'body[data-color-mode="dark"] .MuiTableHead-root .MuiTableCell-root': {
              backgroundColor: '#1e293b !important',
              color: '#dbeafe !important',
            },
            'body[data-color-mode="dark"] .MuiInputBase-root': {
              backgroundColor: '#0f172a !important',
              color: '#e5e7eb !important',
            },
            'body[data-color-mode="dark"] .MuiInputLabel-root, body[data-color-mode="dark"] .MuiFormHelperText-root': {
              color: '#94a3b8 !important',
            },
            'body[data-color-mode="dark"] .MuiOutlinedInput-notchedOutline': {
              borderColor: '#475569 !important',
            },
            'body[data-color-mode="dark"] .MuiTypography-root': {
              color: 'inherit',
            },
            'body[data-color-mode="dark"] .MuiChip-root': {
              borderColor: '#475569',
            },
          }}
        />
        <RouterProvider router={router} />
      </ThemeProvider>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: isDarkMode ? '#111827' : '#ffffff',
            border: `1px solid ${isDarkMode ? '#334155' : '#dbe4f0'}`,
            color: isDarkMode ? '#e5e7eb' : '#0f172a',
            fontSize: 14,
            fontWeight: 700,
          },
          success: {
            iconTheme: {
              primary: '#15803d',
              secondary: '#ffffff',
            },
          },
          error: {
            iconTheme: {
              primary: '#dc2626',
              secondary: '#ffffff',
            },
          },
        }}
      />
    </ColorModeContext.Provider>
  )
}

export default App
