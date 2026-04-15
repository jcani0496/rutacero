import Link from 'next/link';

import { MAIN_CONTENT_ID } from '@/lib/accessibility';

export function SkipToContentLink() {
  return (
    <Link
      href={`#${MAIN_CONTENT_ID}`}
      className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-foreground focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
    >
      Saltar al contenido principal
    </Link>
  );
}
