import "./globals.css";

export const metadata = {
  title: "Inkwell — Personal Writing Studio",
  description: "Write like a developer. Publish like a creator.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
