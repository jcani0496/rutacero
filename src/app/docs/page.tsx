'use client';

import dynamic from 'next/dynamic';
import 'swagger-ui-react/swagger-ui.css';

// Dynamically import SwaggerUI to avoid SSR issues
const SwaggerUI = dynamic(() => import('swagger-ui-react'), { ssr: false });

/**
 * API Documentation Page
 *
 * Displays interactive Swagger UI for API documentation
 */
export default function DocsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">RutaCero API Documentation</h1>
          <p className="text-muted-foreground">
            Documentación completa de webhooks y endpoints de la API de RutaCero
          </p>
        </div>

        <div className="bg-card rounded-lg shadow-lg overflow-hidden">
          <SwaggerUI url="/api/docs" />
        </div>
      </div>
    </div>
  );
}
