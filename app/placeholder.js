import Link from "next/link";

// Stands in for sign-up and sign-in until ticket 01 builds them.
export default function Placeholder({ title }) {
  return (
    <main className="placeholder">
      <h1>{title}</h1>
      <Link href="/" className="quiet-link">
        Back to Redline
      </Link>
    </main>
  );
}
