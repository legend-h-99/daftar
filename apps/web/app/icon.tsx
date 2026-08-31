import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";
export const dynamic = "force-static";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          backgroundImage: "linear-gradient(135deg, #4C1D95, #7C3AED)",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "22%",
        }}
      >
        <span
          style={{
            color: "white",
            fontSize: 310,
            fontWeight: 900,
            lineHeight: 1,
            fontFamily: "sans-serif",
            letterSpacing: "-0.02em",
          }}
        >
          د
        </span>
      </div>
    ),
    { ...size },
  );
}
