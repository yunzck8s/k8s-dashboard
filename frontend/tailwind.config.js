/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // 自定义暗色主题颜色
        dark: {
          bg: '#0f172a',
          card: '#1e293b',
          border: '#334155',
          hover: '#475569',
        },
        // K8s 资源状态颜色
        k8s: {
          running: '#22c55e',
          pending: '#eab308',
          failed: '#ef4444',
          succeeded: '#3b82f6',
          unknown: '#6b7280',
        },
        // K8s Copilot Chat 主题颜色
        primary: '#137fec',
        'background-light': '#f6f7f8',
        'background-dark': '#101922',
      },
      fontFamily: {
        display: ['Space Grotesk', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '0.25rem',
        lg: '0.5rem',
        xl: '0.75rem',
        full: '9999px',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}
