import { ImageResponse } from "next/og";

const SIZES = new Set([180, 192, 512]);

// Monochrome app icon: a white "B" on black, drawn at request time and cached.
export async function GET(_req: Request, { params }: { params: Promise<{ size: string }> }) {
  const size = Number((await params).size);
  if (!SIZES.has(size)) return new Response("Not found", { status: 404 });

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0a0a",
          color: "#f5f5f5",
          fontSize: size * 0.56,
          fontWeight: 700,
          letterSpacing: -size * 0.02,
        }}
      >
        B
      </div>
    ),
    { width: size, height: size, headers: { "Cache-Control": "public, max-age=604800, immutable" } },
  );
}
