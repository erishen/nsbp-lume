/**
 * Tailwind 只负责 base/utilities 与扫描 content；nsbp-lume 的自定义视觉
 * （渐变卡片、hero 光效、nav 下划线等）按原 styled-components 值原样搬进
 * src/css/tailwind.css 的自定义类，保证外观不漂移。
 */
module.exports = {
  content: ["./src/**/*.{ts,tsx}", "./public/index.html"],
  theme: {
    extend: {
      colors: {
        // nsbp 主色（home.ts / header.ts 里反复出现的 #667eea→#764ba2）
        brand: {
          from: "#667eea",
          to: "#764ba2",
        },
      },
    },
  },
  plugins: [],
};
