export const useServerApi = import.meta.env.VITE_API_USE_SERVER === 'true'

export const apiBaseUrl = import.meta.env.VITE_API_BASE_URL
  ?? (useServerApi
    ? import.meta.env.VITE_SERVER_API_BASE_URL
    : import.meta.env.VITE_LOCAL_API_BASE_URL)

export const apiOrigin = apiBaseUrl?.replace(/\/api\/?$/, '') ?? ''
