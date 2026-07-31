import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";
export const dynamic = "force-static";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#0f7353",
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
            fontSize: 300,
            fontWeight: 800,
            lineHeight: 1,
            fontFamily: "serif",
          }}
        >
          د
        </span>
      </div>
    ),
    { ...size },
  );
}
