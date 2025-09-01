import daisyui from "daisyui";
import lineClamp from "@tailwindcss/line-clamp";

export default {
    content: ["./index.html", "./src/**/*.{ts,tsx}"],
    theme: { extend: {} },
    plugins: [daisyui, lineClamp],
};
