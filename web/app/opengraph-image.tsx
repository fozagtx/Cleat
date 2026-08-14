import { ImageResponse } from "next/og";

export const alt = "Cleat confidential invoice checks";
export const size = {
  height: 630,
  width: 1200,
};
export const contentType = "image/png";

export default function OpenGraphImage() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://cleat-finance.vercel.app";

  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "stretch",
          background: "#ffffff",
          boxSizing: "border-box",
          color: "#111111",
          display: "flex",
          fontFamily: "Arial, Helvetica, sans-serif",
          height: "100%",
          padding: "56px 60px",
          position: "relative",
          width: "100%",
        }}
      >
        <div
          style={{
            background: "#c24d0e",
            height: 14,
            left: 0,
            position: "absolute",
            top: 0,
            width: "100%",
          }}
        />

        <div
          style={{
            display: "flex",
            flex: 1,
            flexDirection: "column",
            justifyContent: "space-between",
            paddingRight: 52,
          }}
        >
          <div style={{ alignItems: "center", display: "flex", gap: 12 }}>
            <svg
              fill="#c24d0e"
              height="36"
              viewBox="0 0 32 32"
              width="36"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M11 8.5a4.5 4.5 0 0 1 4.2 4.5h1.6A4.5 4.5 0 0 1 21 8.5a4.5 4.5 0 0 1 4.5 4.5v3.2A3.3 3.3 0 0 1 22.2 19.5h-3.4L16 17.4l-2.8 2.1H9.8A3.3 3.3 0 0 1 6.5 16.2V13A4.5 4.5 0 0 1 11 8.5Z" />
            </svg>
            <span style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-1px" }}>Cleat</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <span
              style={{
                color: "#525252",
                fontFamily: "monospace",
                fontSize: 16,
                letterSpacing: "1.5px",
                marginBottom: 22,
                textTransform: "uppercase",
              }}
            >
              Selective disclosure for receivables
            </span>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                fontSize: 68,
                fontWeight: 500,
                letterSpacing: "-3px",
                lineHeight: 0.98,
              }}
            >
              <span>Finance one invoice.</span>
              <span style={{ color: "#c24d0e" }}>Not the whole book.</span>
            </div>
          </div>

          <div style={{ color: "#525252", display: "flex", fontSize: 18 }}>
            Built on Flare Confidential Compute · Coston2
          </div>
        </div>

        <div
          style={{
            alignItems: "center",
            borderRadius: 10,
            boxSizing: "border-box",
            color: "#ffffff",
            display: "flex",
            flexShrink: 0,
            justifyContent: "center",
            overflow: "hidden",
            padding: 50,
            position: "relative",
            width: 480,
          }}
        >
          <img
            alt=""
            height="518"
            src={`${siteUrl}/landing/hero.jpg`}
            style={{
              height: 518,
              left: 0,
              objectFit: "cover",
              position: "absolute",
              top: 0,
              width: 480,
            }}
            width="480"
          />
          <div
            style={{
              background: "rgb(0 0 0 / 0.46)",
              height: "100%",
              left: 0,
              position: "absolute",
              top: 0,
              width: "100%",
            }}
          />
          <div
            style={{
              background: "#0f0f0f",
              border: "1px solid #ffffff24",
              borderRadius: 10,
              boxSizing: "border-box",
              boxShadow: "0 24px 80px rgb(0 0 0 / 0.45)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              position: "relative",
              width: 340,
            }}
          >
            <div
              style={{
                alignItems: "center",
                borderBottom: "1px solid #ffffff18",
                display: "flex",
                gap: 12,
                padding: "12px 14px",
              }}
            >
              <div style={{ display: "flex", gap: 6 }}>
                <span style={{ background: "#ff5f57", borderRadius: 10, height: 10, width: 10 }} />
                <span style={{ background: "#febc2e", borderRadius: 10, height: 10, width: 10 }} />
                <span style={{ background: "#28c840", borderRadius: 10, height: 10, width: 10 }} />
              </div>
              <span
                style={{
                  color: "#a3a3a3",
                  fontFamily: "monospace",
                  fontSize: 12,
                  letterSpacing: "0.3px",
                }}
              >
                cleat / review
              </span>
            </div>

            <div style={{ display: "flex" }}>
              <div
                style={{
                  background: "#161616",
                  borderRight: "1px solid #ffffff18",
                  display: "flex",
                  flex: 1,
                  flexDirection: "column",
                  padding: 22,
                }}
              >
                <span
                  style={{
                    color: "#a3a3a3",
                    fontFamily: "monospace",
                    fontSize: 12,
                    letterSpacing: "0.5px",
                  }}
                >
                  INVOICE
                </span>
                <span style={{ fontFamily: "monospace", fontSize: 18, marginTop: 12 }}>INV-001</span>
                <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 28 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#a3a3a3", fontSize: 14 }}>Customer</span>
                    <span style={{ color: "#d5d5d5", fontFamily: "monospace", fontSize: 13 }}>••••••</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#a3a3a3", fontSize: 14 }}>Face</span>
                    <span style={{ color: "#d5d5d5", fontFamily: "monospace", fontSize: 13 }}>••••••</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#a3a3a3", fontSize: 14 }}>Due</span>
                    <span style={{ color: "#d5d5d5", fontFamily: "monospace", fontSize: 13 }}>••••••</span>
                  </div>
                </div>
              </div>

              <div
                style={{
                  background: "#0f0f0f",
                  display: "flex",
                  flex: 1,
                  flexDirection: "column",
                  padding: 22,
                }}
              >
                <span
                  style={{
                    color: "#a3a3a3",
                    fontFamily: "monospace",
                    fontSize: 12,
                    letterSpacing: "0.5px",
                  }}
                >
                  RESULT
                </span>
                <span style={{ fontSize: 21, fontWeight: 600, marginTop: 12 }}>Clear to fund</span>
                <span style={{ color: "#a3a3a3", fontSize: 14, lineHeight: 1.5, marginTop: 20 }}>
                  Not already pledged here.
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
