import { ImageResponse } from "next/og";

export const runtime = "edge";

export const size = {
	width: 1200,
	height: 630,
};

export const contentType = "image/png";

export default function OpenGraphImage() {
	return new ImageResponse(
		(
			<div
				style={{
					width: "100%",
					height: "100%",
					display: "flex",
					flexDirection: "column",
					justifyContent: "center",
					alignItems: "center",
					background: "linear-gradient(135deg, #111214 0%, #1e1f22 100%)",
					color: "#F5F5F3",
					fontSize: 64,
					fontWeight: 700,
					letterSpacing: "0.02em",
				}}
			>
				<div style={{ fontSize: 28, color: "#E8593C", marginBottom: 18 }}>KeyArena</div>
				<div>Type Fast. Race Live.</div>
			</div>
		),
		size,
	);
}
