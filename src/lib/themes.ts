import type { ThemeId, ThemePreference } from "../types";

export const themes: {
  id: ThemeId;
  name: string;
  description: string;
  swatch: string;
  dark: boolean;
}[] = [
  {
    id: "dawn",
    name: "雾紫晨光",
    description: "淡紫与柔粉，光线穿过清晨的雾",
    swatch: "linear-gradient(130deg,#e4cfe8,#bac6df,#ead9d6)",
    dark: false,
  },
  {
    id: "glacier",
    name: "冰川蓝",
    description: "冰蓝与青灰，清透而宁静",
    swatch: "linear-gradient(130deg,#cfedf1,#9bbace,#d7e5ef)",
    dark: false,
  },
  {
    id: "silver",
    name: "月光银",
    description: "银灰与珍珠白，让照片成为主角",
    swatch: "linear-gradient(130deg,#e9e9ed,#bfc3cb,#f1eee7)",
    dark: false,
  },
  {
    id: "rose",
    name: "玫瑰暮色",
    description: "柔粉与暖杏，留住日落的温度",
    swatch: "linear-gradient(130deg,#dab4bc,#bfaebf,#edd3bd)",
    dark: false,
  },
  {
    id: "forest",
    name: "森林薄雾",
    description: "鼠尾草绿与雾白，呼吸自然",
    swatch: "linear-gradient(130deg,#a9beb2,#c9d8ca,#849f9b)",
    dark: false,
  },
  {
    id: "graphite",
    name: "深空石墨",
    description: "午夜蓝与微紫，安静的深色玻璃",
    swatch: "linear-gradient(130deg,#354154,#242a3c,#54475e)",
    dark: true,
  },
];
export function isTheme(value: unknown): value is ThemePreference {
  return value === "system" || themes.some((theme) => theme.id === value);
}
export function resolveTheme(
  preference: ThemePreference,
  systemDark: boolean,
): ThemeId {
  return preference === "system"
    ? systemDark
      ? "graphite"
      : "dawn"
    : preference;
}
export function readTheme(): ThemePreference {
  try {
    const value: unknown = JSON.parse(
      localStorage.getItem("airgallery.preferences.v1") || "{}",
    ).theme;
    return isTheme(value) ? value : "dawn";
  } catch {
    return "dawn";
  }
}
