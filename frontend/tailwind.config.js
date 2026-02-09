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
        // Enterprise SaaS 主题色
        primary: {
          DEFAULT: '#6366F1',
          hover: '#818CF8',
          light: 'rgba(99, 102, 241, 0.15)',
          50: '#EEF2FF',
          100: '#E0E7FF',
          200: '#C7D2FE',
          300: '#A5B4FC',
          400: '#818CF8',
          500: '#6366F1',
          600: '#4F46E5',
          700: '#4338CA',
          800: '#3730A3',
          900: '#312E81',
        },
        // 表面色
        surface: {
          primary: '#0c0a1d',
          secondary: '#13102a',
          tertiary: '#1a1635',
          elevated: '#211d40',
        },
        // K8s 资源状态颜色
        k8s: {
          running: '#10B981',
          pending: '#F59E0B',
          failed: '#EF4444',
          succeeded: '#3B82F6',
          unknown: '#6B7280',
        },
        // 语义色
        success: '#10B981',
        warning: '#F59E0B',
        error: '#EF4444',
        info: '#3B82F6',
      },
      fontFamily: {
        sans: ['Fira Sans', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['Fira Code', 'monospace'],
      },
      borderRadius: {
        'xl': '12px',
        '2xl': '16px',
      },
      transitionDuration: {
        '150': '150ms',
        '200': '200ms',
        '300': '300ms',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}
