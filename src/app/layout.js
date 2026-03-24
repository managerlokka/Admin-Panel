import './globals.css';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Sidebar from '@/components/Sidebar';

export const metadata = {
  title: 'Manager Lokka Admin',
  description: 'Subscription Management Admin Panel',
};

export default async function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <LayoutContent>{children}</LayoutContent>
      </body>
    </html>
  );
}

async function LayoutContent({ children }) {
  const session = await getSession();

  // If not on login page and not authenticated, show without sidebar
  // The page itself will handle redirect
  if (!session) {
    return <>{children}</>;
  }

  return (
    <div className="app-layout">
      <Sidebar adminName={session.name} adminEmail={session.email} />
      <main className="main-content">{children}</main>
    </div>
  );
}
