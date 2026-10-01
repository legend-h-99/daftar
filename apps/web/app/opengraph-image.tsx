import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Daftar";
export const dynamic = "force-static";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          backgroundImage: "linear-gradient(135deg, #4C1D95, #7C3AED)",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 32,
        }}
      >
        <div
          style={{
            width: 220,
            height: 220,
            borderRadius: 48,
            background: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#5B21B6",
            fontSize: 150,
            fontWeight: 900,
            fontFamily: "sans-serif",
          }}
        >
          د
        </div>
        <span style={{ color: "white", fontSize: 72, fontWeight: 800, fontFamily: "sans-serif" }}>Daftar</span>
      </div>
    ),
    { ...size },
  );
}
