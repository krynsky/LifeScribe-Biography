// App entry point — router and shell wired up in U3
export default function App() {
  return (
    <div className="flex h-full items-center justify-center" style={{ background: "var(--color-background)" }}>
      <div className="text-center">
        <h1 style={{ fontFamily: "var(--font-heading)", color: "var(--color-primary)", fontSize: "2rem", marginBottom: "0.5rem" }}>
          LifeScribe
        </h1>
        <p style={{ color: "var(--color-text-secondary)" }}>Your life story, beautifully preserved.</p>
      </div>
    </div>
  );
}
