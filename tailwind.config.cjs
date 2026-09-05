module.exports = {
  content: ['./react.html', './src/**/*.{js,ts,tsx}'],
  darkMode: 'class',
  theme: { extend: {
    fontFamily: { sans: ['Segoe UI Variable', 'SF Pro Display', 'Helvetica Neue', 'PingFang SC', 'Microsoft YaHei', 'sans-serif'] },
    animation: { 'fade-in': 'fadeIn 0.2s ease-out', 'slide-up': 'slideUp 0.3s ease-out' },
    keyframes: {
      fadeIn: { from: { opacity: 0, transform: 'scale(0.98)' }, to: { opacity: 1, transform: 'scale(1)' } },
      slideUp: { from: { opacity: 0, transform: 'translateY(20px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
    },
  } },
};
