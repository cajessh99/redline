import "./globals.css";

export const metadata = {
  title: "Redline",
  description:
    "Upload a client contract you haven't signed. Redline flags each clause that matches one of your red lines and quotes the sentence it came from.",
};

export const viewport = {
  themeColor: "#d6d5cf",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
