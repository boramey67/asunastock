/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        cream: '#FAF7F2',
        ink: '#2B2523',
        inkfade: '#6B615C',
        berry: '#9B4A5C',
        berryDark: '#7A3949',
        sage: '#7A8B6F',
        sand: '#EFE7DA',
        line: '#E3D9C9',
      },
      fontFamily: {
        display: ['"Fraunces"', 'serif'],
        body: ['"Inter"', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
