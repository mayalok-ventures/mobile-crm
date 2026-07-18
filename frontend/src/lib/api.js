import axios from 'axios';

const getBaseUrl = () => {
  // Production API Endpoint (Cloudflare Pages + AWS ECS Fargate + Custom Domain)
  return 'https://api.coresetu.com/api';

  /*
  // Local development and raw ALB testing endpoints (commented out for production launch)
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
  if (process.env.NODE_ENV === 'production') return 'http://crm-alb-1015746865.eu-north-1.elb.amazonaws.com/api';
  if (typeof window !== 'undefined') return `http://${window.location.hostname}:5000/api`;
  return 'http://localhost:5000/api';
  */
};

const API_URL = getBaseUrl();

const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
});

// Inject token on every request
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors globally
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (typeof window !== 'undefined') {
      if (err.response?.status === 403 && err.response?.data?.code === 'SUSPENDED') {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        const reason = encodeURIComponent(err.response.data.message || 'Account suspended.');
        window.location.href = `/login?error=suspended&reason=${reason}`;
      } else if (err.response?.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export default api;
