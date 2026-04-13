import Link from "next/link";

export default function HomePage() {
  return (
    <main style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
      <Link href="/docs">Go to Documentation</Link>
    </main>
  );
}
